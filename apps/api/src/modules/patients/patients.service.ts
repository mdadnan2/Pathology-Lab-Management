import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { AuditAction, OrderStatus, ResultStatus, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

const MAX_AGE_YEARS = 120;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function isLaboratoryRole(role: Role): boolean {
  return role === Role.TECHNICIAN || role === Role.PATHOLOGIST;
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async generatePatientCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.patient.count({
      where: { createdAt: { gte: startOfUtcDay(today) } },
    });
    return `PAT-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  private validateDateOfBirth(value: string | Date): Date {
    const dateOfBirth = new Date(value);
    const today = new Date();
    const earliest = new Date(today);
    earliest.setFullYear(earliest.getFullYear() - MAX_AGE_YEARS);

    if (
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth >= startOfUtcDay(today) ||
      dateOfBirth < startOfUtcDay(earliest)
    ) {
      throw new BadRequestException(
        'Date of birth must be in the past and no more than 120 years ago',
      );
    }
    return dateOfBirth;
  }

  async create(dto: CreatePatientDto, actorId: string) {
    const duplicate = await this.prisma.patient.findFirst({
      where: {
        phone: dto.phone,
        isActive: true,
      },
    });

    const patientCode = await this.generatePatientCode();

    const patient = await this.prisma.patient.create({
      data: {
        patientCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: this.validateDateOfBirth(dto.dateOfBirth),
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        address: dto.address,
      },
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.PATIENT_CREATED,
      entityType: 'Patient',
      entityId: patient.id,
    });

    return {
      data: patient,
      meta: duplicate
        ? { duplicateWarning: true, existingPatientId: duplicate.id }
        : { duplicateWarning: false },
    };
  }

  private patientWorkScope(role: Role) {
    if (role === Role.TECHNICIAN) {
      return {
        orders: {
          some: {
            status: { in: [OrderStatus.SAMPLE_COLLECTED, OrderStatus.PROCESSING, OrderStatus.RESULT_ENTERED] },
          },
        },
      };
    }
    if (role === Role.PATHOLOGIST) {
      return {
        orders: {
          some: {
            items: {
              some: {
                result: { is: { status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] } } },
              },
            },
          },
        },
      };
    }
    return {};
  }

  async findAll(params: { page: number; limit: number; search?: string; role: Role }) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;
    const labRole = isLaboratoryRole(role);

    const where = {
      isActive: true,
      ...this.patientWorkScope(role),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          ...(!labRole ? [{ phone: { contains: search } }] : []),
          { patientCode: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        ...(labRole
          ? {
              select: {
                id: true,
                patientCode: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true,
              },
            }
          : {}),
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data: patients, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, role: Role) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, isActive: true, ...this.patientWorkScope(role) },
      ...(isLaboratoryRole(role)
        ? {
            select: {
              id: true,
              patientCode: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
            },
          }
        : {}),
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, actorId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');

    const { dateOfBirth, ...patientFields } = dto;
    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        ...patientFields,
        ...(dateOfBirth && {
          dateOfBirth: this.validateDateOfBirth(dateOfBirth),
        }),
      },
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.PATIENT_UPDATED,
      entityType: 'Patient',
      entityId: id,
    });

    return updated;
  }

  async getOrderHistory(patientId: string, role: Role) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, isActive: true, ...this.patientWorkScope(role) },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.labOrder.findMany({
      where: {
        patientId,
        ...(role === Role.TECHNICIAN
          ? { status: { in: [OrderStatus.SAMPLE_COLLECTED, OrderStatus.PROCESSING, OrderStatus.RESULT_ENTERED] } }
          : role === Role.PATHOLOGIST
            ? {
                items: {
                  some: {
                    result: { is: { status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] } } },
                  },
                },
              }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { labTest: { select: { name: true, code: true } } } },
        invoice: role === Role.TECHNICIAN || role === Role.PATHOLOGIST
          ? false
          : { select: { invoiceNumber: true, totalAmount: true, paidAmount: true, status: true } },
        samples: { select: { sampleId: true, status: true } },
      },
    });
  }
}
