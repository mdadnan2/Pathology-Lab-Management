import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  OrderItemStatus,
  OrderStatus,
  ResultStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReviewResultDto, SaveResultDto } from './dto/result.dto';

const ENTRY_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.SAMPLE_COLLECTED,
  OrderStatus.PROCESSING,
  OrderStatus.RESULT_ENTERED,
  OrderStatus.UNDER_REVIEW,
];

const RESULT_INCLUDE = {
  parameters: {
    include: {
      testParameter: true,
    },
  },
  enteredBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  orderItem: {
    include: {
      order: {
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      labTest: {
        include: { parameters: { orderBy: { sortOrder: 'asc' as const } } },
      },
    },
  },
};

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    status?: ResultStatus;
    actorId: string;
    isTechnician: boolean;
  }) {
    const { page, limit, status, actorId, isTechnician } = params;
    const where = {
      ...(isTechnician
        ? status
          ? { result: { is: { status, enteredById: actorId } } }
          : {
              OR: [
                { result: { is: null } },
                { result: { is: { enteredById: actorId } } },
              ],
            }
        : status
          ? { result: { is: { status } } }
          : {}),
      order: { status: { in: ENTRY_ORDER_STATUSES } },
      status: { not: OrderItemStatus.CANCELLED },
    };
    const [data, total] = await Promise.all([
      this.prisma.labOrderItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { order: { createdAt: 'desc' } },
        include: {
          order: {
            include: {
              patient: {
                select: {
                  id: true,
                  patientCode: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          labTest: { include: { parameters: { orderBy: { sortOrder: 'asc' } } } },
          result: { include: RESULT_INCLUDE },
        },
      }),
      this.prisma.labOrderItem.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, actorId: string, isTechnician: boolean) {
    const result = await this.prisma.testResult.findUnique({
      where: { id },
      include: RESULT_INCLUDE,
    });
    if (!result) throw new NotFoundException('Result not found');
    if (isTechnician && result.enteredById !== actorId) {
      throw new NotFoundException('Result not found');
    }
    return result;
  }

  async saveDraft(orderItemId: string, dto: SaveResultDto, actorId: string) {
    const item = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: { select: { id: true, status: true } },
        labTest: { include: { parameters: true } },
        result: { include: { parameters: true } },
      },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (!ENTRY_ORDER_STATUSES.includes(item.order.status)) {
      throw new BadRequestException(
        'Results can only be entered after sample collection has started',
      );
    }
    if (item.status === OrderItemStatus.CANCELLED) {
      throw new ConflictException('Cannot enter a result for a cancelled order item');
    }
    if (
      item.result &&
      item.result.status !== ResultStatus.DRAFT &&
      item.result.status !== ResultStatus.REJECTED
    ) {
      throw new ConflictException('Only draft or rejected results can be edited');
    }

    const parameterIds = item.labTest.parameters.map((parameter) => parameter.id);
    const suppliedIds = dto.parameters.map((parameter) => parameter.testParameterId);
    if (new Set(suppliedIds).size !== suppliedIds.length) {
      throw new BadRequestException('A result parameter can only be entered once');
    }
    if (suppliedIds.some((id) => !parameterIds.includes(id))) {
      throw new BadRequestException('One or more parameters do not belong to this test');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const current = await tx.testResult.findUnique({ where: { orderItemId } });
      let resultId: string;
      if (current) {
        const changed = await tx.testResult.updateMany({
          where: {
            id: current.id,
            status: { in: [ResultStatus.DRAFT, ResultStatus.REJECTED] },
          },
          data: {
            enteredById: actorId,
            status: ResultStatus.DRAFT,
            reviewedById: null,
            reviewedAt: null,
            notes: dto.notes,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException('The result changed and can no longer be edited');
        }
        resultId = current.id;
      } else {
        const created = await tx.testResult.create({
          data: {
            orderItemId,
            enteredById: actorId,
            status: ResultStatus.DRAFT,
            notes: dto.notes,
          },
        });
        resultId = created.id;
      }

      await tx.resultParameter.deleteMany({ where: { testResultId: resultId } });
      if (dto.parameters.length > 0) {
        await tx.resultParameter.createMany({
          data: dto.parameters.map((entry) => {
            const parameter = item.labTest.parameters.find(
              (candidate) => candidate.id === entry.testParameterId,
            );
            if (!parameter) {
              throw new BadRequestException('One or more parameters do not belong to this test');
            }
            const normalizedValue = entry.value.trim();
            const isNumeric = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(
              normalizedValue,
            );
            const low = parameter.referenceRangeLow
              ? new Decimal(parameter.referenceRangeLow.toString())
              : null;
            const high = parameter.referenceRangeHigh
              ? new Decimal(parameter.referenceRangeHigh.toString())
              : null;
            const value = isNumeric ? new Decimal(normalizedValue) : null;
            return {
              testResultId: resultId,
              testParameterId: parameter.id,
              value: normalizedValue,
              unit: parameter.unit,
              isAbnormal: Boolean(
                value && ((low && value.lessThan(low)) || (high && value.greaterThan(high))),
              ),
            };
          }),
        });
      }
      return tx.testResult.findUnique({
        where: { id: resultId },
        include: RESULT_INCLUDE,
      });
    });

    if (!saved) throw new NotFoundException('Saved result could not be loaded');
    await this.auditService.log({
      actorId,
      action: AuditAction.RESULT_ENTERED,
      entityType: 'TestResult',
      entityId: saved.id,
      metadata: { orderItemId, parameterCount: dto.parameters.length },
    });
    return saved;
  }

  async submit(id: string, actorId: string) {
    const result = await this.prisma.testResult.findUnique({
      where: { id },
      include: {
        parameters: true,
        orderItem: {
          include: {
            order: { select: { status: true } },
            labTest: { include: { parameters: true } },
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    if (result.status !== ResultStatus.DRAFT) {
      throw new ConflictException('Only draft results can be submitted; rejected results must be re-entered');
    }
    if (!ENTRY_ORDER_STATUSES.includes(result.orderItem.order.status)) {
      throw new ConflictException('Cannot submit a result for an order outside the processing workflow');
    }
    const expected = result.orderItem.labTest.parameters;
    if (
      expected.length === 0 ||
      expected.some(
        (parameter) =>
          !result.parameters.some(
            (value) =>
              value.testParameterId === parameter.id && value.value.trim() !== '',
          ),
      )
    ) {
      throw new BadRequestException('Enter a value for every test parameter before submitting');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.testResult.updateMany({
        where: { id, status: ResultStatus.DRAFT },
        data: { status: ResultStatus.SUBMITTED, rejectionReason: null },
      });
      if (changed.count !== 1) {
        throw new ConflictException('The result changed and can no longer be submitted');
      }
      await tx.labOrderItem.update({
        where: { id: result.orderItemId },
        data: { status: OrderItemStatus.RESULT_ENTERED },
      });
      await tx.labOrder.updateMany({
        where: {
          id: result.orderItem.orderId,
          status: { in: ENTRY_ORDER_STATUSES },
        },
        data: { status: OrderStatus.RESULT_ENTERED },
      });
      const saved = await tx.testResult.findUnique({ where: { id } });
      if (!saved) throw new NotFoundException('Submitted result could not be loaded');
      return saved;
    });
    await this.auditService.log({
      actorId,
      action: AuditAction.RESULT_SUBMITTED,
      entityType: 'TestResult',
      entityId: id,
    });
    return updated;
  }

  async review(id: string, dto: ReviewResultDto, actorId: string) {
    const result = await this.prisma.testResult.findUnique({
      where: { id },
      include: { orderItem: { include: { order: { select: { status: true } } } } },
    });
    if (!result) throw new NotFoundException('Result not found');
    if (result.orderItem.order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Cannot review a result for a cancelled order');
    }
    if (
      result.status !== ResultStatus.SUBMITTED &&
      result.status !== ResultStatus.UNDER_REVIEW
    ) {
      throw new ConflictException('Only submitted results can be reviewed');
    }
    if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException('Invalid result review status');
    }
    if (
      dto.status === ResultStatus.UNDER_REVIEW &&
      result.status !== ResultStatus.SUBMITTED
    ) {
      throw new ConflictException('Only submitted results can enter review');
    }
    if (dto.status === ResultStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }
    if (dto.status !== ResultStatus.REJECTED && dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is only allowed when rejecting');
    }

    const nextStatus = dto.status as ResultStatus;
    if (
      nextStatus !== ResultStatus.UNDER_REVIEW &&
      result.status !== ResultStatus.UNDER_REVIEW
    ) {
      throw new ConflictException('Move the result under review before approving or rejecting it');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.testResult.updateMany({
        where: {
          id,
          status: nextStatus === ResultStatus.UNDER_REVIEW
            ? ResultStatus.SUBMITTED
            : ResultStatus.UNDER_REVIEW,
        },
        data: {
          status: nextStatus,
          reviewedById: actorId,
          reviewedAt: new Date(),
          rejectionReason: nextStatus === ResultStatus.REJECTED
            ? dto.rejectionReason?.trim() ?? null
            : null,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('The result changed and can no longer be reviewed');
      }
      if (nextStatus === ResultStatus.APPROVED) {
        await tx.labOrderItem.update({
          where: { id: result.orderItemId },
          data: { status: OrderItemStatus.APPROVED },
        });
        const items = await tx.labOrderItem.findMany({
          where: { orderId: result.orderItem.orderId, status: { not: OrderItemStatus.CANCELLED } },
          select: { status: true },
        });
        if (items.length > 0 && items.every((item) => item.status === OrderItemStatus.APPROVED)) {
          await tx.labOrder.update({
            where: { id: result.orderItem.orderId },
            data: { status: OrderStatus.APPROVED },
          });
        }
      } else if (nextStatus === ResultStatus.UNDER_REVIEW) {
        await tx.labOrder.updateMany({
          where: {
            id: result.orderItem.orderId,
            status: { in: ENTRY_ORDER_STATUSES },
          },
          data: { status: OrderStatus.UNDER_REVIEW },
        });
      }
      const saved = await tx.testResult.findUnique({ where: { id } });
      if (!saved) throw new NotFoundException('Reviewed result could not be loaded');
      return saved;
    });

    if (nextStatus !== ResultStatus.UNDER_REVIEW) {
      await this.auditService.log({
        actorId,
        action: nextStatus === ResultStatus.APPROVED
          ? AuditAction.RESULT_APPROVED
          : AuditAction.RESULT_REJECTED,
        entityType: 'TestResult',
        entityId: id,
      });
    }
    return updated;
  }
}
