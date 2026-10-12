import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus, SampleStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SamplesService } from './samples.service';

describe('SamplesService transitions', () => {
  const prisma = {
    sample: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  let service: SamplesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SamplesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('does not allow sample changes for a cancelled order', async () => {
    prisma.sample.findUnique.mockResolvedValue({
      id: 'sample-1',
      status: SampleStatus.PENDING,
      order: { status: OrderStatus.CANCELLED },
    });

    await expect(
      service.updateStatus(
        'sample-1',
        { status: SampleStatus.COLLECTED },
        'technician-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects skipping directly from pending to completed', async () => {
    prisma.sample.findUnique.mockResolvedValue({
      id: 'sample-1',
      status: SampleStatus.PENDING,
      order: { status: OrderStatus.NEW },
    });

    await expect(
      service.updateStatus(
        'sample-1',
        { status: SampleStatus.COMPLETED },
        'technician-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a reason when rejecting a sample', async () => {
    prisma.sample.findUnique.mockResolvedValue({
      id: 'sample-1',
      status: SampleStatus.PENDING,
      order: { status: OrderStatus.NEW },
    });

    await expect(
      service.updateStatus(
        'sample-1',
        { status: SampleStatus.REJECTED },
        'technician-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('advances the order and test items when a pending sample is collected', async () => {
    prisma.sample.findUnique.mockResolvedValue({
      id: 'sample-1',
      orderId: 'order-1',
      status: SampleStatus.PENDING,
      order: { status: OrderStatus.NEW },
    });
    const tx = {
      sample: { update: jest.fn().mockResolvedValue({ id: 'sample-1' }) },
      labOrder: { update: jest.fn().mockResolvedValue({}) },
      labOrderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    await service.updateStatus(
      'sample-1',
      { status: SampleStatus.COLLECTED },
      'technician-1',
    );

    expect(tx.labOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.SAMPLE_COLLECTED },
    });
    expect(tx.labOrderItem.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: 'order-1',
        status: { in: ['PENDING', 'SAMPLE_COLLECTED'] },
      },
      data: { status: 'SAMPLE_COLLECTED' },
    });
  });
});
