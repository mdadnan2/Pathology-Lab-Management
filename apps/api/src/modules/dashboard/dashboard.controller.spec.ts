import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  const prisma = {
    patient: { count: jest.fn() },
    labOrder: { count: jest.fn() },
    sample: { count: jest.fn() },
    labTest: { count: jest.fn() },
    testCategory: { count: jest.fn() },
  };
  let controller: DashboardController;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.count.mockResolvedValue(24);
    prisma.labOrder.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    prisma.sample.count.mockResolvedValueOnce(6).mockResolvedValueOnce(7);
    prisma.labTest.count.mockResolvedValue(8);
    prisma.testCategory.count.mockResolvedValue(9);
    controller = new DashboardController(prisma as unknown as PrismaService);
  });

  it('returns all operational dashboard counts from their corresponding tables', async () => {
    await expect(controller.getStats()).resolves.toEqual({
      totalPatients: 24,
      pendingOrders: 3,
      processingOrders: 4,
      completedOrders: 5,
      pendingSamples: 6,
      collectedSamples: 7,
      totalTests: 8,
      activeCategories: 9,
    });

    expect(prisma.patient.count).toHaveBeenCalledWith({
      where: { isActive: true },
    });
    expect(prisma.labOrder.count).toHaveBeenNthCalledWith(1, {
      where: { status: 'NEW' },
    });
    expect(prisma.labOrder.count).toHaveBeenNthCalledWith(2, {
      where: { status: 'PROCESSING' },
    });
    expect(prisma.labOrder.count).toHaveBeenNthCalledWith(3, {
      where: { status: OrderStatus.REPORT_READY },
    });
    expect(prisma.sample.count).toHaveBeenNthCalledWith(1, {
      where: { status: 'PENDING' },
    });
    expect(prisma.sample.count).toHaveBeenNthCalledWith(2, {
      where: { status: 'COLLECTED' },
    });
    expect(prisma.labTest.count).toHaveBeenCalledWith({
      where: { isActive: true },
    });
    expect(prisma.testCategory.count).toHaveBeenCalledTimes(1);
  });

  it('propagates database errors instead of returning incomplete metrics', async () => {
    const databaseError = new Error('Database unavailable');
    prisma.patient.count.mockRejectedValue(databaseError);

    await expect(controller.getStats()).rejects.toBe(databaseError);
  });
});
