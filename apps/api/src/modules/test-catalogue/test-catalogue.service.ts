import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateLabTestDto, UpdateLabTestDto,
  CreateTestCategoryDto, CreateTestParameterDto,
} from './dto/test-catalogue.dto';

@Injectable()
export class TestCatalogueService {
  private readonly logger = new Logger(TestCatalogueService.name);

  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async createCategory(dto: CreateTestCategoryDto, _actorId: string) {
    const existing = await this.prisma.testCategory.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Category code already exists');
    return this.prisma.testCategory.create({
      data: dto,
    });
  }

  async findAllCategories() {
    return this.prisma.testCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateLabTestDto, actorId: string) {
    const existing = await this.prisma.labTest.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Test code already exists');

    const category = await this.prisma.testCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    const test = await this.prisma.labTest.create({
      data: {
        code: dto.code,
        name: dto.name,
        categoryId: dto.categoryId,
        specimenType: dto.specimenType,
        department: dto.department,
        price: dto.price,
        turnaroundHours: dto.turnaroundHours ?? 24,
        description: dto.description,
      },
      include: { category: true, parameters: true },
    });

    await this.auditService.log({
      actorId, action: AuditAction.TEST_CREATED,
      entityType: 'LabTest', entityId: test.id,
      metadata: { code: test.code, price: test.price.toString() },
    });

    return test;
  }

  async findAll(params: { page: number; limit: number; search?: string; categoryId?: string; activeOnly?: boolean }) {
    const { page, limit, search, categoryId, activeOnly } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(activeOnly !== false && { isActive: true }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [tests, total] = await Promise.all([
      this.prisma.labTest.findMany({
        where, skip, take: limit, orderBy: { name: 'asc' },
        include: { category: true, parameters: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.labTest.count({ where }),
    ]);

    return { data: tests, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const test = await this.prisma.labTest.findUnique({
      where: { id },
      include: { category: true, parameters: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  async update(id: string, dto: UpdateLabTestDto, actorId: string) {
    const test = await this.prisma.labTest.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');

    const updated = await this.prisma.labTest.update({
      where: { id }, data: dto,
      include: { category: true, parameters: true },
    });

    await this.auditService.log({
      actorId, action: AuditAction.TEST_UPDATED,
      entityType: 'LabTest', entityId: id,
      metadata: { changes: Object.keys(dto) },
    });

    return updated;
  }

  async toggleActive(id: string, actorId: string) {
    const test = await this.prisma.labTest.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');

    const updated = await this.prisma.labTest.update({
      where: { id }, data: { isActive: !test.isActive },
    });

    await this.auditService.log({
      actorId,
      action: updated.isActive ? AuditAction.TEST_UPDATED : AuditAction.TEST_DEACTIVATED,
      entityType: 'LabTest', entityId: id,
    });

    return updated;
  }

  async addParameter(dto: CreateTestParameterDto) {
    const test = await this.prisma.labTest.findUnique({ where: { id: dto.labTestId } });
    if (!test) throw new NotFoundException('Test not found');

    return this.prisma.testParameter.create({ data: dto });
  }
}
