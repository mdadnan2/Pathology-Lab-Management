import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AuditEventPayload {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(payload: AuditEventPayload): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorId: payload.actorId,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: payload.metadata ?? undefined,
      },
    });
  }

  async findAll(params: {
    page: number;
    limit: number;
    actorId?: string;
    action?: AuditAction;
    entityType?: string;
    from?: Date;
    to?: Date;
  }) {
    const { page, limit, actorId, action, entityType, from, to } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(actorId && { actorId }),
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, role: true, employeeCode: true },
          },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
