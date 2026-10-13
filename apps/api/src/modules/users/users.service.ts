import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { AuditAction } from '@prisma/client';
import { PermissionsService } from '../../common/permissions/permissions.service';
import { PermissionKey } from '../../common/permissions/permission-policy';

const ADMIN_MANAGED_ROLES = [
  Role.RECEPTIONIST,
  Role.TECHNICIAN,
  Role.PATHOLOGIST,
];

function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return (
    actorRole === Role.OWNER ||
    (targetRole !== Role.OWNER &&
      targetRole !== Role.ADMIN &&
      ADMIN_MANAGED_ROLES.includes(targetRole))
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private permissionsService: PermissionsService,
  ) {}

  private async generateEmployeeCode(): Promise<string> {
    const count = await this.prisma.user.count();
    return `EMP-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateUserDto, actorId: string, actorRole: Role) {
    if (!canManageRole(actorRole, dto.role)) {
      throw new ForbiddenException(
        `An ${actorRole} cannot create an account with the ${dto.role} role`,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const employeeCode = await this.generateEmployeeCode();

    const user = await this.prisma.user.create({
      data: {
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        mustChangePassword: true,
      },
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.USER_CREATED,
      entityType: 'User',
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll(params: { page: number; limit: number; search?: string; role?: Role }) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { employeeCode: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, actorRole: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (!canManageRole(actorRole, user.role)) {
      throw new ForbiddenException(
        `An ${actorRole} cannot manage an account with the ${user.role} role`,
      );
    }
    if (dto.role && id === actorId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    if (dto.role && !canManageRole(actorRole, dto.role)) {
      throw new ForbiddenException(
        `An ${actorRole} cannot assign the ${dto.role} role`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        email: true, phone: true, role: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.USER_UPDATED,
      entityType: 'User',
      entityId: id,
    });

    return updated;
  }

  async grantPermission(
    id: string,
    permission: PermissionKey,
    actorId: string,
    reason: string,
  ) {
    return this.permissionsService.grant(id, permission, actorId, reason);
  }

  async revokePermission(
    id: string,
    permission: PermissionKey,
    actorId: string,
    reason: string,
  ) {
    return this.permissionsService.revoke(id, permission, actorId, reason);
  }

  async deactivate(id: string, actorId: string, actorRole: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (!canManageRole(actorRole, user.role)) {
      throw new ForbiddenException(
        `An ${actorRole} cannot deactivate an account with the ${user.role} role`,
      );
    }

    if (id === actorId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    await this.prisma.user.update({ where: { id }, data: { isActive: false } });

    await this.auditService.log({
      actorId,
      action: AuditAction.USER_DEACTIVATED,
      entityType: 'User',
      entityId: id,
    });

    return { message: 'User deactivated' };
  }

  async resetPassword(id: string, actorId: string, actorRole: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (!canManageRole(actorRole, user.role)) {
      throw new ForbiddenException(
        `An ${actorRole} cannot reset the password of an account with the ${user.role} role`,
      );
    }

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: id,
    });

    return { temporaryPassword };
  }
}
