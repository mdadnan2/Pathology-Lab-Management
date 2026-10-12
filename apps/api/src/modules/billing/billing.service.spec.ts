import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  InvoiceStatus,
  PaymentMethod,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prisma = {
    invoice: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financialAdjustment: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  let service: BillingService;

  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'invoice-1',
    subtotal: '100.00',
    discountAmount: '0.00',
    totalAmount: '100.00',
    paidAmount: '0.00',
    status: InvoiceStatus.UNPAID,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.invoice.findUnique.mockResolvedValue(invoice());
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.update.mockResolvedValue({});
    prisma.payment.create.mockResolvedValue({ id: 'payment-1' });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      invoiceId: 'invoice-1',
      amount: '20.01',
      isReversed: false,
    });
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.update.mockResolvedValue({});
    prisma.financialAdjustment.create.mockResolvedValue({});
    auditService.log.mockResolvedValue(undefined);
    service = new BillingService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('filters and paginates invoices', async () => {
    const data = [{ id: 'invoice-1' }];
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');
    prisma.invoice.findMany.mockResolvedValue(data);
    prisma.invoice.count.mockResolvedValue(11);

    const result = await service.findAll({
      page: 3,
      limit: 5,
      status: InvoiceStatus.PARTIALLY_PAID,
      patientId: 'patient-1',
      from,
      to,
      search: 'PAT-1',
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: InvoiceStatus.PARTIALLY_PAID,
          patientId: 'patient-1',
          createdAt: { gte: from, lte: to },
          OR: expect.arrayContaining([
            { invoiceNumber: { contains: 'PAT-1', mode: 'insensitive' } },
          ]),
        }),
        skip: 10,
        take: 5,
      }),
    );
    expect(result).toEqual({
      data,
      meta: { page: 3, limit: 5, total: 11, totalPages: 3 },
    });
  });

  it('records exact decimal payments and marks a fully settled invoice paid', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      invoice({ subtotal: '100.10', totalAmount: '100.10', paidAmount: '50.05' }),
    );

    await service.recordPayment(
      'invoice-1',
      { amount: 50.05, method: PaymentMethod.CASH },
      'cashier-1',
    );

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceId: 'invoice-1',
        amount: '50.05',
        method: PaymentMethod.CASH,
        recordedById: 'cashier-1',
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { paidAmount: '100.10', status: InvoiceStatus.PAID },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'cashier-1',
        action: AuditAction.PAYMENT_RECORDED,
      }),
    );
  });

  it('rejects a payment that exceeds the invoice balance without writing', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      invoice({ totalAmount: '100.00', paidAmount: '99.99' }),
    );

    await expect(
      service.recordPayment(
        'invoice-1',
        { amount: 0.02, method: PaymentMethod.UPI },
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([InvoiceStatus.PAID, InvoiceStatus.CANCELLED])(
    'rejects recording payment for a %s invoice',
    async (status) => {
      prisma.invoice.findUnique.mockResolvedValue(invoice({ status }));

      await expect(
        service.recordPayment(
          'invoice-1',
          { amount: 1, method: PaymentMethod.CASH },
          'cashier-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('applies a discount using decimal arithmetic and audits the adjustment', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      invoice({ subtotal: '100.00', discountAmount: '2.25', paidAmount: '10.00' }),
    );

    await service.applyDiscount(
      'invoice-1',
      { amount: 3.15, reason: 'Correction' },
      'admin-1',
      Role.ADMIN,
    );

    expect(prisma.financialAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceId: 'invoice-1',
        type: 'DISCOUNT',
        amount: '3.15',
        reason: 'Correction',
        authorizedById: 'admin-1',
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: {
        discountAmount: '5.40',
        totalAmount: '94.60',
        status: InvoiceStatus.PARTIALLY_PAID,
      },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DISCOUNT_APPLIED }),
    );
  });

  it('restricts discounts to owners and admins', async () => {
    await expect(
      service.applyDiscount(
        'invoice-1',
        { amount: 1, reason: 'Correction' },
        'receptionist-1',
        Role.RECEPTIONIST,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a discount that would eliminate the invoice total', async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice());

    await expect(
      service.applyDiscount(
        'invoice-1',
        { amount: 100, reason: 'Invalid discount' },
        'owner-1',
        Role.OWNER,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancels an unpaid invoice with an adjustment and audit record', async () => {
    await service.cancelInvoice(
      'invoice-1',
      { reason: 'Duplicate order' },
      'owner-1',
      Role.OWNER,
    );

    expect(prisma.financialAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceId: 'invoice-1',
        type: 'CANCELLATION',
        amount: '100.00',
        reason: 'Duplicate order',
        authorizedById: 'owner-1',
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: InvoiceStatus.CANCELLED, cancelledAt: expect.any(Date) },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.INVOICE_CANCELLED }),
    );
  });

  it('does not allow cancelling an invoice with a non-zero paid balance', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      invoice({ paidAmount: '0.01', status: InvoiceStatus.PARTIALLY_PAID }),
    );

    await expect(
      service.cancelInvoice(
        'invoice-1',
        { reason: 'Duplicate order' },
        'owner-1',
        Role.OWNER,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reverses a payment and recalculates the invoice balance precisely', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      invoice({ totalAmount: '100.00', paidAmount: '50.05' }),
    );

    await service.reversePayment('invoice-1', 'payment-1', 'admin-1', Role.ADMIN);

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { isReversed: true, reversedAt: expect.any(Date) },
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { paidAmount: '30.04', status: InvoiceStatus.PARTIALLY_PAID },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PAYMENT_REVERSED }),
    );
  });

  it('rejects reversing a payment belonging to a different invoice', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      invoiceId: 'invoice-other',
      amount: '20.01',
      isReversed: false,
    });

    await expect(
      service.reversePayment('invoice-1', 'payment-1', 'admin-1', Role.ADMIN),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aggregates collections per day and method using exact decimal totals', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        paidAt: new Date('2026-02-03T09:00:00.000Z'),
        amount: '10.10',
        method: PaymentMethod.CASH,
      },
      {
        paidAt: new Date('2026-02-03T12:00:00.000Z'),
        amount: '0.20',
        method: PaymentMethod.CASH,
      },
      {
        paidAt: new Date('2026-02-03T15:00:00.000Z'),
        amount: '4.50',
        method: PaymentMethod.UPI,
      },
    ]);
    prisma.invoice.findMany.mockResolvedValue([
      { totalAmount: '100.00', paidAmount: '70.25' },
      { totalAmount: '20.00', paidAmount: '10.10' },
    ]);

    const from = new Date('2026-02-01T00:00:00.000Z');
    const to = new Date('2026-02-05T23:59:59.999Z');
    const result = await service.getDailyCollections(from, to);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isReversed: false, paidAt: { gte: from, lte: to } },
      }),
    );
    expect(result).toEqual({
      rows: [{
        date: '2026-02-03',
        totalCollected: '14.80',
        byMethod: { CASH: '10.30', UPI: '4.50' },
      }],
      outstanding: '39.65',
    });
  });

  it('returns paginated outstanding invoices', async () => {
    const data = [{ id: 'invoice-1' }];
    prisma.invoice.findMany.mockResolvedValue(data);
    prisma.invoice.count.mockResolvedValue(12);

    const result = await service.getOutstandingDues({ page: 2, limit: 5 });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result).toEqual({
      data,
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
  });
});
