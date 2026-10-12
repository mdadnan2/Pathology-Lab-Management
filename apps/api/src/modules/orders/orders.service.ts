import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { AuditAction, OrderStatus, SampleStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto, CancelOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const count = await this.prisma.labOrder.count({ where: { createdAt: { gte: startOfDay } } });
    return `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateSampleId(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const count = await this.prisma.sample.count({ where: { createdAt: { gte: startOfDay } } });
    return `SMP-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const count = await this.prisma.invoice.count({ where: { createdAt: { gte: startOfDay } } });
    return `INV-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateOrderDto, actorId: string) {
    const selectedTestIds = (dto.items ?? []).map((item) => item.labTestId);
    const packageIds = dto.packageIds ?? [];
    if (selectedTestIds.length === 0 && packageIds.length === 0) {
      throw new BadRequestException('Order must have at least one test item');
    }
    if (new Set(selectedTestIds).size !== selectedTestIds.length) {
      throw new BadRequestException('A test cannot be selected more than once');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient || !patient.isActive) throw new NotFoundException('Patient not found');

    const [tests, packages] = await Promise.all([
      this.prisma.labTest.findMany({
        where: { id: { in: selectedTestIds }, isActive: true },
      }),
      this.prisma.testPackage.findMany({
        where: { id: { in: packageIds }, isActive: true },
        include: { items: { include: { labTest: true } } },
      }),
    ]);

    if (
      tests.length !== selectedTestIds.length ||
      packages.length !== packageIds.length
    ) {
      throw new BadRequestException('One or more tests not found or inactive');
    }

    const testsById = new Map(tests.map((test) => [test.id, test]));
    const lineItems: Array<{
      labTestId: string;
      testNameSnapshot: string;
      priceSnapshot: Decimal;
    }> = selectedTestIds.map((labTestId) => {
      const test = testsById.get(labTestId);
      if (!test) {
        throw new BadRequestException('One or more tests not found or inactive');
      }
      return {
        labTestId: test.id,
        testNameSnapshot: test.name,
        priceSnapshot: new Decimal(test.price.toString()),
      };
    });
    const includedTestIds = new Set(lineItems.map((item) => item.labTestId));

    for (const pkg of packages) {
      if (
        pkg.items.length === 0 ||
        pkg.items.some((item) => !item.labTest.isActive)
      ) {
        throw new BadRequestException(
          `Package "${pkg.name}" contains no active tests`,
        );
      }
      const packageTestIds = pkg.items.map((item) => item.labTestId);
      if (packageTestIds.some((id) => includedTestIds.has(id))) {
        throw new BadRequestException(
          `Package "${pkg.name}" contains a test already selected for this order`,
        );
      }
      packageTestIds.forEach((id) => includedTestIds.add(id));

      const packagePrice = new Decimal(pkg.price.toString());
      const totalCents = packagePrice.mul(100).toDecimalPlaces(0);
      const baseCents = totalCents.dividedToIntegerBy(pkg.items.length);
      const remainderCents = totalCents.mod(pkg.items.length).toNumber();
      pkg.items.forEach((item, index) => {
        lineItems.push({
          labTestId: item.labTestId,
          testNameSnapshot: item.labTest.name,
          priceSnapshot: baseCents
            .plus(index < remainderCents ? 1 : 0)
            .div(100),
        });
      });
    }

    const orderNumber = await this.generateOrderNumber();
    const sampleId = await this.generateSampleId();
    const invoiceNumber = await this.generateInvoiceNumber();

    const subtotal = lineItems.reduce(
      (sum, item) => sum.plus(item.priceSnapshot),
      new Decimal(0),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.create({
        data: {
          orderNumber,
          patientId: dto.patientId,
          notes: dto.notes,
          createdById: actorId,
          items: {
            create: lineItems.map((item) => ({
              labTestId: item.labTestId,
              testNameSnapshot: item.testNameSnapshot,
              priceSnapshot: item.priceSnapshot.toFixed(2),
            })),
          },
        },
        include: { items: true },
      });

      await tx.sample.create({
        data: { sampleId, orderId: order.id },
      });

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          patientId: dto.patientId,
          subtotal: subtotal.toFixed(2),
          totalAmount: subtotal.toFixed(2),
          createdById: actorId,
          items: {
            create: order.items.map((item) => ({
              orderItemId: item.id,
              testNameSnapshot: item.testNameSnapshot,
              priceSnapshot: item.priceSnapshot,
            })),
          },
        },
      });

      return { order, invoice };
    });

    await this.auditService.log({
      actorId, action: AuditAction.ORDER_CREATED,
      entityType: 'LabOrder', entityId: result.order.id,
      metadata: {
        orderNumber,
        invoiceNumber,
        testCount: lineItems.length,
        packageCount: packages.length,
      },
    });

    return this.findOne(result.order.id);
  }

  async findAll(params: {
    page: number; limit: number; search?: string;
    status?: OrderStatus; sampleStatus?: SampleStatus; patientId?: string; from?: Date; to?: Date;
  }) {
    const { page, limit, search, status, sampleStatus, patientId, from, to } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(sampleStatus && { samples: { some: { status: sampleStatus } } }),
      ...(patientId && { patientId }),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { patient: { firstName: { contains: search, mode: 'insensitive' as const } } },
          { patient: { lastName: { contains: search, mode: 'insensitive' as const } } },
          { patient: { patientCode: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientCode: true, firstName: true, lastName: true, phone: true } },
          items: { include: { labTest: { select: { name: true, code: true } } } },
          samples: { select: { sampleId: true, status: true } },
          invoice: { select: { invoiceNumber: true, totalAmount: true, paidAmount: true, status: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);

    return { data: orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        patient: true,
        items: {
          include: { labTest: { include: { parameters: true } } },
        },
        samples: { include: { collectedBy: { select: { firstName: true, lastName: true } } } },
        invoice: { include: { items: true, payments: true } },
        report: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancel(id: string, dto: CancelOrderDto, actorId: string) {
    const order = await this.prisma.labOrder.findUnique({ where: { id }, include: { report: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order already cancelled');
    if (order.report?.status === 'APPROVED') throw new BadRequestException('Cannot cancel order with approved report');

    await this.prisma.labOrder.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.reason },
    });

    await this.auditService.log({
      actorId, action: AuditAction.ORDER_CANCELLED,
      entityType: 'LabOrder', entityId: id,
      metadata: { reason: dto.reason },
    });

    return { message: 'Order cancelled' };
  }
}
