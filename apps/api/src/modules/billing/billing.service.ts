import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { AuditAction, InvoiceStatus, Role } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecordPaymentDto, ApplyDiscountDto, CancelInvoiceDto } from './dto/billing.dto';
import { ReversePaymentDto } from './dto/billing.dto';
import { PermissionsService } from '../../common/permissions/permissions.service';
import { PERMISSIONS } from '../../common/permissions/permission-policy';

const INVOICE_INCLUDE = {
  patient: { select: { id: true, patientCode: true, firstName: true, lastName: true, phone: true } },
  order: { select: { id: true, orderNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  items: { include: { orderItem: { select: { labTestId: true } } } },
  payments: {
    orderBy: { paidAt: 'desc' as const },
    include: { recordedBy: { select: { firstName: true, lastName: true, employeeCode: true } } },
  },
  adjustments: {
    orderBy: { createdAt: 'desc' as const },
    include: { authorizedBy: { select: { firstName: true, lastName: true, employeeCode: true } } },
  },
} as const;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private permissionsService: PermissionsService,
  ) {}

  async findAll(params: {
    page: number; limit: number;
    status?: InvoiceStatus; patientId?: string; from?: Date; to?: Date; search?: string;
  }) {
    const { page, limit, status, patientId, from, to, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(patientId && { patientId }),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
          { patient: { firstName: { contains: search, mode: 'insensitive' as const } } },
          { patient: { lastName: { contains: search, mode: 'insensitive' as const } } },
          { patient: { patientCode: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
          order: { select: { orderNumber: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async recordPayment(id: string, dto: RecordPaymentDto, actorId: string) {
    await this.permissionsService.assertUserPermission(actorId, PERMISSIONS.PAYMENTS_RECORD);
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Cannot record payment on a cancelled invoice');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Invoice is already fully paid');

    const balance = new Decimal(invoice.totalAmount.toString()).minus(invoice.paidAmount.toString());
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Payment amount must be greater than zero');
    if (amount.gt(balance)) throw new BadRequestException(`Payment amount exceeds balance of ${balance.toFixed(2)}`);

    const newPaidAmount = new Decimal(invoice.paidAmount.toString()).plus(amount);
    const newStatus = newPaidAmount.gte(invoice.totalAmount.toString())
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

    const payment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: {
          id,
          status: invoice.status,
          paidAmount: invoice.paidAmount,
          totalAmount: invoice.totalAmount,
        },
        data: { paidAmount: newPaidAmount.toFixed(2), status: newStatus },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice changed while recording the payment; retry');
      }
      const created = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: amount.toFixed(2),
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          recordedById: actorId,
        },
      });
      return created;
    });

    await this.auditService.log({
      actorId, action: AuditAction.PAYMENT_RECORDED,
      entityType: 'Invoice', entityId: id,
      metadata: { paymentId: payment.id, amount: amount.toFixed(2), method: dto.method },
    });

    return this.findOne(id);
  }

  async applyDiscount(id: string, dto: ApplyDiscountDto, actorId: string, actorRole: Role) {
    await this.permissionsService.assertUserPermission(actorId, PERMISSIONS.BILLING_APPLY_DISCOUNT);
    if (typeof dto.reason !== 'string' || dto.reason.trim().length < 5) {
      throw new BadRequestException('A discount reason of at least 5 characters is required');
    }
    const reason = dto.reason.trim();
    if (actorRole !== Role.OWNER && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Only OWNER or ADMIN can apply discounts');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Cannot discount a cancelled invoice');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Cannot discount a fully paid invoice');

    const discountAmount = new Decimal(dto.amount);
    const subtotal = new Decimal(invoice.subtotal.toString());
    const existingDiscount = new Decimal(invoice.discountAmount.toString());
    const totalDiscount = existingDiscount.plus(discountAmount);

    if (discountAmount.lte(0)) throw new BadRequestException('Discount amount must be greater than zero');
    if (totalDiscount.gte(subtotal)) throw new BadRequestException('Total discount cannot equal or exceed subtotal');

    const newTotal = subtotal.minus(totalDiscount);
    const paidAmount = new Decimal(invoice.paidAmount.toString());
    const newStatus = paidAmount.gte(newTotal)
      ? InvoiceStatus.PAID
      : paidAmount.gt(0) ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.UNPAID;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: {
          id,
          status: invoice.status,
          paidAmount: invoice.paidAmount,
          subtotal: invoice.subtotal,
          discountAmount: invoice.discountAmount,
          totalAmount: invoice.totalAmount,
        },
        data: {
          discountAmount: totalDiscount.toFixed(2),
          totalAmount: newTotal.toFixed(2),
          status: newStatus,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice changed while applying the discount; retry');
      }
      await tx.financialAdjustment.create({
        data: {
          invoiceId: id,
          type: 'DISCOUNT',
          amount: discountAmount.toFixed(2),
          reason,
          authorizedById: actorId,
        },
      });
    });

    await this.auditService.log({
      actorId, action: AuditAction.DISCOUNT_APPLIED,
      entityType: 'Invoice', entityId: id,
      metadata: { amount: discountAmount.toFixed(2), reason },
    });

    return this.findOne(id);
  }

  async cancelInvoice(id: string, dto: CancelInvoiceDto, actorId: string, actorRole: Role) {
    await this.permissionsService.assertUserPermission(actorId, PERMISSIONS.INVOICES_CANCEL);
    if (typeof dto.reason !== 'string' || dto.reason.trim().length < 5) {
      throw new BadRequestException('A cancellation reason of at least 5 characters is required');
    }
    const reason = dto.reason.trim();
    if (actorRole !== Role.OWNER && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Only OWNER or ADMIN can cancel invoices');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Invoice already cancelled');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Cannot cancel a fully paid invoice; reverse payments first');

    const paidAmount = new Decimal(invoice.paidAmount.toString());
    if (paidAmount.gt(0)) throw new BadRequestException('Reverse all payments before cancelling this invoice');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { id, status: invoice.status, paidAmount: invoice.paidAmount },
        data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice changed while cancelling; retry');
      }
      await tx.financialAdjustment.create({
        data: {
          invoiceId: id,
          type: 'CANCELLATION',
          amount: invoice.totalAmount,
          reason,
          authorizedById: actorId,
        },
      });
    });

    await this.auditService.log({
      actorId, action: AuditAction.INVOICE_CANCELLED,
      entityType: 'Invoice', entityId: id,
      metadata: { reason },
    });

    return this.findOne(id);
  }

  async reversePayment(
    invoiceId: string,
    paymentId: string,
    dto: ReversePaymentDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.permissionsService.assertUserPermission(actorId, PERMISSIONS.PAYMENTS_REVERSE);
    if (typeof dto.reason !== 'string' || dto.reason.trim().length < 5) {
      throw new BadRequestException('A reversal reason of at least 5 characters is required');
    }
    const reason = dto.reason.trim();
    if (actorRole !== Role.OWNER && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Only OWNER or ADMIN can reverse payments');
    }

    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.invoiceId !== invoiceId) throw new NotFoundException('Payment not found');
    if (payment.isReversed) throw new BadRequestException('Payment already reversed');

    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.prisma.$transaction(async (tx) => {
      const reversed = await tx.payment.updateMany({
        where: { id: paymentId, invoiceId, isReversed: false },
        data: { isReversed: true, reversedAt: new Date() },
      });
      if (reversed.count !== 1) {
        throw new ConflictException('Payment was already reversed; refresh and retry');
      }
      const currentInvoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!currentInvoice) throw new NotFoundException('Invoice not found');
      const currentPaidAmount = new Decimal(currentInvoice.paidAmount.toString());
      const currentNewPaidAmount = currentPaidAmount.minus(payment.amount.toString());
      if (currentNewPaidAmount.lt(0)) {
        throw new ConflictException('Invoice balance is inconsistent with its payments');
      }
      const currentNewStatus = currentNewPaidAmount.lte(0)
        ? InvoiceStatus.UNPAID
        : currentNewPaidAmount.gte(currentInvoice.totalAmount.toString())
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;
      const updated = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          status: currentInvoice.status,
          paidAmount: currentInvoice.paidAmount,
          totalAmount: currentInvoice.totalAmount,
        },
        data: {
          paidAmount: currentNewPaidAmount.toFixed(2),
          status: currentNewStatus,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice changed while reversing the payment; retry');
      }
      await tx.financialAdjustment.create({
        data: {
          invoiceId,
          type: 'REVERSAL',
          amount: payment.amount,
          reason,
          authorizedById: actorId,
        },
      });
    });

    await this.auditService.log({
      actorId, action: AuditAction.PAYMENT_REVERSED,
      entityType: 'Invoice', entityId: invoiceId,
      metadata: { paymentId, amount: payment.amount.toString(), reason },
    });

    return this.findOne(invoiceId);
  }

  async getDailyCollections(from: Date, to: Date) {
    const payments = await this.prisma.payment.findMany({
      where: { isReversed: false, paidAt: { gte: from, lte: to } },
      select: { paidAt: true, amount: true, method: true },
      orderBy: { paidAt: 'asc' },
    });

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
      },
      select: { totalAmount: true, paidAmount: true },
    });

    const outstanding = invoices.reduce(
      (sum, inv) => sum.plus(new Decimal(inv.totalAmount.toString()).minus(inv.paidAmount.toString())),
      new Decimal(0),
    );

    const byDate = new Map<string, { totalCollected: Decimal; byMethod: Record<string, Decimal> }>();
    for (const payment of payments) {
      const dateKey = payment.paidAt.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, { totalCollected: new Decimal(0), byMethod: {} });
      const entry = byDate.get(dateKey)!;
      entry.totalCollected = entry.totalCollected.plus(payment.amount.toString());
      entry.byMethod[payment.method] = (entry.byMethod[payment.method] ?? new Decimal(0)).plus(payment.amount.toString());
    }

    const rows = Array.from(byDate.entries()).map(([date, entry]) => ({
      date,
      totalCollected: entry.totalCollected.toFixed(2),
      byMethod: Object.fromEntries(
        Object.entries(entry.byMethod).map(([method, amount]) => [method, (amount as Decimal).toFixed(2)]),
      ),
    }));

    return { rows, outstanding: outstanding.toFixed(2) };
  }

  async getOutstandingDues(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const where = { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] } };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'asc' },
        include: {
          patient: { select: { patientCode: true, firstName: true, lastName: true, phone: true } },
          order: { select: { orderNumber: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
