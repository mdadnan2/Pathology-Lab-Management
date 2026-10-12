import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTestPackageDto, UpdateTestPackageDto } from './dto/test-package.dto';

@Injectable()
export class TestPackagesService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateTestPackageDto, actorId: string) {
    const existing = await this.prisma.testPackage.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Package name already exists');

    const tests = await this.prisma.labTest.findMany({
      where: { id: { in: dto.testIds }, isActive: true },
      select: { id: true },
    });
    if (tests.length !== dto.testIds.length) {
      throw new NotFoundException('One or more tests were not found or are inactive');
    }

    const pkg = await this.prisma.testPackage.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        items: { create: dto.testIds.map((labTestId) => ({ labTestId })) },
      },
      include: { items: { include: { labTest: true } } },
    });

    await this.auditService.log({
      actorId, action: AuditAction.PACKAGE_CREATED,
      entityType: 'TestPackage', entityId: pkg.id,
    });

    return pkg;
  }

  async findAll(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;
    const where = {
      isActive: true,
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    };

    const [packages, total] = await Promise.all([
      this.prisma.testPackage.findMany({
        where, skip, take: limit, orderBy: { name: 'asc' },
        include: { items: { include: { labTest: { include: { category: true } } } } },
      }),
      this.prisma.testPackage.count({ where }),
    ]);

    return { data: packages, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const pkg = await this.prisma.testPackage.findUnique({
      where: { id },
      include: { items: { include: { labTest: { include: { category: true, parameters: true } } } } },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async update(id: string, dto: UpdateTestPackageDto, actorId: string) {
    const pkg = await this.prisma.testPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');

    if (dto.testIds) {
      if (new Set(dto.testIds).size !== dto.testIds.length) {
        throw new ConflictException('A test can only appear once in a package');
      }
      const tests = await this.prisma.labTest.findMany({
        where: { id: { in: dto.testIds }, isActive: true },
        select: { id: true },
      });
      if (tests.length !== dto.testIds.length) {
        throw new NotFoundException('One or more tests were not found or are inactive');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.testIds) {
        await tx.testPackageItem.deleteMany({ where: { packageId: id } });
        await tx.testPackageItem.createMany({
          data: dto.testIds.map((labTestId) => ({ packageId: id, labTestId })),
        });
      }
      return tx.testPackage.update({
        where: { id },
        data: { name: dto.name, description: dto.description, price: dto.price },
        include: { items: { include: { labTest: true } } },
      });
    });

    await this.auditService.log({
      actorId, action: AuditAction.PACKAGE_UPDATED,
      entityType: 'TestPackage', entityId: id,
    });

    return updated;
  }
}
