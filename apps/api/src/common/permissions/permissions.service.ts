import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, PermissionEventType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GRANTABLE_CLINICAL_PERMISSIONS,
  PermissionKey,
  ROLE_PERMISSIONS,
  isPermissionKey,
} from './permission-policy';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissions(userId: string, role: Role): Promise<PermissionKey[]> {
    const effective = new Set<PermissionKey>(ROLE_PERMISSIONS[role]);
    const events = await this.prisma.userPermissionEvent.findMany({
      where: { userId },
      orderBy: { sequence: 'desc' },
      select: { permission: true, eventType: true },
    });
    const seen = new Set<string>();
    for (const event of events) {
      if (seen.has(event.permission) || !isPermissionKey(event.permission)) continue;
      seen.add(event.permission);
      if (event.eventType === PermissionEventType.GRANTED) {
        effective.add(event.permission);
      } else {
        effective.delete(event.permission);
      }
    }
    return [...effective];
  }

  async assertUserPermission(userId: string, permission: PermissionKey): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive) throw new ForbiddenException('Access denied');
    const permissions = await this.getPermissions(userId, user.role);
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  async grant(
    targetUserId: string,
    permission: PermissionKey,
    actorId: string,
    reason: string,
  ) {
    if (typeof reason !== 'string' || reason.trim().length < 5) {
      throw new ForbiddenException('A permission-change reason of at least 5 characters is required');
    }
    if (!GRANTABLE_CLINICAL_PERMISSIONS.includes(permission)) {
      throw new ForbiddenException('Only explicit clinical permissions may be granted here');
    }
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot grant permissions to yourself');
    }
    await this.assertUserPermission(actorId, 'settings.manage');
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });
    if (!target?.isActive) throw new ForbiddenException('Target user is not active');

    const permissions = await this.getPermissions(targetUserId, (
      await this.prisma.user.findUniqueOrThrow({
        where: { id: targetUserId },
        select: { role: true },
      })
    ).role);
    if (permissions.includes(permission)) {
      throw new ForbiddenException('User already has this permission');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionEvent.create({
        data: {
          userId: targetUserId,
          actorId,
          permission,
          eventType: PermissionEventType.GRANTED,
          reason: reason.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: AuditAction.PERMISSION_GRANTED,
          entityType: 'User',
          entityId: targetUserId,
          metadata: { permission, reason: reason.trim() } as Prisma.InputJsonObject,
        },
      });
    });
    return this.getPermissions(
      targetUserId,
      (await this.prisma.user.findUniqueOrThrow({
        where: { id: targetUserId },
        select: { role: true },
      })).role,
    );
  }

  async revoke(
    targetUserId: string,
    permission: PermissionKey,
    actorId: string,
    reason: string,
  ) {
    if (typeof reason !== 'string' || reason.trim().length < 5) {
      throw new ForbiddenException('A permission-change reason of at least 5 characters is required');
    }
    if (!GRANTABLE_CLINICAL_PERMISSIONS.includes(permission)) {
      throw new ForbiddenException('Only explicit clinical permissions may be revoked here');
    }
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot revoke permissions from yourself');
    }
    await this.assertUserPermission(actorId, 'settings.manage');
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target?.isActive) throw new ForbiddenException('Target user is not active');

    const effective = await this.getPermissions(targetUserId, target.role);
    if (!effective.includes(permission)) {
      throw new ForbiddenException('User does not have this permission');
    }
    if (ROLE_PERMISSIONS[target.role].includes(permission)) {
      throw new ForbiddenException('Default role permissions cannot be revoked here');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionEvent.create({
        data: {
          userId: targetUserId,
          actorId,
          permission,
          eventType: PermissionEventType.REVOKED,
          reason: reason.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: AuditAction.PERMISSION_REVOKED,
          entityType: 'User',
          entityId: targetUserId,
          metadata: { permission, reason: reason.trim() } as Prisma.InputJsonObject,
        },
      });
    });
    return this.getPermissions(targetUserId, target.role);
  }
}
