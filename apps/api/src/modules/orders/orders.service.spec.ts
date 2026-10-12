import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService package pricing and snapshots', () => {
  const prisma = {
    patient: { findUnique: jest.fn() },
    labTest: { findMany: jest.fn() },
    testPackage: { findMany: jest.fn() },
    labOrder: { count: jest.fn(), findUnique: jest.fn() },
    sample: { count: jest.fn() },
    invoice: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', isActive: true });
    prisma.labTest.findMany.mockResolvedValue([]);
    prisma.testPackage.findMany.mockResolvedValue([]);
    prisma.labOrder.count.mockResolvedValue(0);
    prisma.sample.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    auditService.log.mockResolvedValue(undefined);
    service = new OrdersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('distributes a fixed package total exactly across test price snapshots', async () => {
    prisma.testPackage.findMany.mockResolvedValue([
      {
        id: 'package-1',
        name: 'Three-test panel',
        price: '10.00',
        items: ['test-1', 'test-2', 'test-3'].map((id) => ({
          labTestId: id,
          labTest: { id, name: `Test ${id}`, isActive: true },
        })),
      },
    ]);
    const tx = {
      labOrder: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
          items: [
            { id: 'item-1', testNameSnapshot: 'Test test-1', priceSnapshot: '3.34' },
            { id: 'item-2', testNameSnapshot: 'Test test-2', priceSnapshot: '3.33' },
            { id: 'item-3', testNameSnapshot: 'Test test-3', priceSnapshot: '3.33' },
          ],
        }),
      },
      sample: { create: jest.fn().mockResolvedValue({}) },
      invoice: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    prisma.labOrder.findUnique.mockResolvedValue({ id: 'order-1' });

    await service.create(
      { patientId: 'patient-1', packageIds: ['package-1'] },
      'receptionist-1',
    );

    expect(tx.labOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({ priceSnapshot: '3.34' }),
              expect.objectContaining({ priceSnapshot: '3.33' }),
            ]),
          },
        }),
      }),
    );
    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: '10.00',
          totalAmount: '10.00',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_CREATED' }),
    );
  });

  it('rejects an unavailable package without creating any order records', async () => {
    await expect(
      service.create(
        { patientId: 'patient-1', packageIds: ['missing-package'] },
        'receptionist-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
