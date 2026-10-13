import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuditAction, OrderItemStatus, SampleStatus, OrderStatus, ResultStatus, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSampleStatusDto } from './dto/sample.dto';
import { PermissionsService } from '../../common/permissions/permissions.service';
import { PERMISSIONS } from '../../common/permissions/permission-policy';

const VALID_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  PENDING: [SampleStatus.COLLECTED, SampleStatus.REJECTED],
  COLLECTED: [SampleStatus.PROCESSING, SampleStatus.REJECTED],
  PROCESSING: [SampleStatus.COMPLETED, SampleStatus.REJECTED],
  COMPLETED: [],
  REJECTED: [SampleStatus.RECOLLECTION_REQUESTED],
  RECOLLECTION_REQUESTED: [SampleStatus.COLLECTED],
};

const STATUS_TO_ORDER_STATUS: Partial<Record<SampleStatus, OrderStatus>> = {
  COLLECTED: OrderStatus.SAMPLE_COLLECTED,
  PROCESSING: OrderStatus.PROCESSING,
};

const STATUS_TO_ITEM_STATUS: Partial<Record<SampleStatus, OrderItemStatus>> = {
  COLLECTED: OrderItemStatus.SAMPLE_COLLECTED,
  PROCESSING: OrderItemStatus.PROCESSING,
};

const ORDER_STAGE: Record<OrderStatus, number> = {
  NEW: 0,
  SAMPLE_COLLECTED: 1,
  PROCESSING: 2,
  RESULT_ENTERED: 3,
  UNDER_REVIEW: 4,
  APPROVED: 5,
  REPORT_READY: 6,
  CANCELLED: 7,
};

const ELIGIBLE_ITEM_STATUSES: Partial<Record<SampleStatus, OrderItemStatus[]>> = {
  COLLECTED: [OrderItemStatus.PENDING, OrderItemStatus.SAMPLE_COLLECTED],
  PROCESSING: [
    OrderItemStatus.PENDING,
    OrderItemStatus.SAMPLE_COLLECTED,
    OrderItemStatus.PROCESSING,
  ],
};

@Injectable()
export class SamplesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private permissionsService: PermissionsService,
  ) {}

  async findAll(params: { page: number; limit: number; status?: SampleStatus; role: Role }) {
    const { page, limit, status, role } = params;
    const skip = (page - 1) * limit;
    const workScope = role === Role.TECHNICIAN
      ? {
          order: {
            status: {
              in: [
                OrderStatus.SAMPLE_COLLECTED,
                OrderStatus.PROCESSING,
                OrderStatus.RESULT_ENTERED,
              ],
            },
          },
        }
      : role === Role.PATHOLOGIST
        ? {
            order: {
              items: {
                some: {
                  result: {
                    is: {
                      status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] },
                    },
                  },
                },
              },
            },
          }
        : {};
    const where = { ...(status && { status }), ...workScope };

    const [samples, total] = await Promise.all([
      this.prisma.sample.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              patient: { select: { patientCode: true, firstName: true, lastName: true } },
              items: { include: { labTest: { select: { name: true, code: true } } } },
            },
          },
          collectedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.sample.count({ where }),
    ]);

    return { data: samples, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, role: Role) {
    const workScope = role === Role.TECHNICIAN
      ? {
          order: {
            status: {
              in: [
                OrderStatus.SAMPLE_COLLECTED,
                OrderStatus.PROCESSING,
                OrderStatus.RESULT_ENTERED,
              ],
            },
          },
        }
      : role === Role.PATHOLOGIST
        ? {
            order: {
              items: {
                some: {
                  result: {
                    is: {
                      status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] },
                    },
                  },
                },
              },
            },
          }
        : {};
    const sample = await this.prisma.sample.findFirst({
      where: { id, ...workScope },
      include: {
        order: { include: { patient: true, items: { include: { labTest: true } } } },
        collectedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!sample) throw new NotFoundException('Sample not found');
    return sample;
  }

  async updateStatus(id: string, dto: UpdateSampleStatusDto, actorId: string) {
    await this.permissionsService.assertUserPermission(actorId, PERMISSIONS.SAMPLES_UPDATE_STATUS);
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: { order: { select: { status: true } } },
    });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Cannot update a sample for a cancelled order');
    }

    const allowed = VALID_TRANSITIONS[sample.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${sample.status} to ${dto.status}`,
      );
    }

    if (
      dto.status === SampleStatus.REJECTED &&
      !dto.rejectionReason?.trim()
    ) {
      throw new BadRequestException('Rejection reason is required');
    }
    if (
      dto.status !== SampleStatus.REJECTED &&
      dto.rejectionReason?.trim()
    ) {
      throw new BadRequestException(
        'A rejection reason can only be provided when rejecting a sample',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.sample.update({
        where: { id },
        data: {
          status: dto.status,
          rejectionReason: dto.rejectionReason,
          notes: dto.notes,
          ...(dto.status === SampleStatus.COLLECTED && {
            collectedById: actorId,
            collectedAt: new Date(),
          }),
        },
      });

      const orderStatus = STATUS_TO_ORDER_STATUS[dto.status];
      if (
        orderStatus &&
        ORDER_STAGE[orderStatus] >= ORDER_STAGE[sample.order.status]
      ) {
        await tx.labOrder.update({ where: { id: sample.orderId }, data: { status: orderStatus } });
      }
      const itemStatus = STATUS_TO_ITEM_STATUS[dto.status];
      const eligibleItemStatuses = ELIGIBLE_ITEM_STATUSES[dto.status];
      if (itemStatus && eligibleItemStatuses) {
        await tx.labOrderItem.updateMany({
          where: {
            orderId: sample.orderId,
            status: { in: eligibleItemStatuses },
          },
          data: { status: itemStatus },
        });
      }

      return s;
    });

    await this.auditService.log({
      actorId, action: AuditAction.SAMPLE_STATUS_CHANGED,
      entityType: 'Sample', entityId: id,
      metadata: { from: sample.status, to: dto.status },
    });

    return updated;
  }
}
