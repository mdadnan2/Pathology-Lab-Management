import { OrderStatus, ReportStatus, ResultStatus, Role, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  const prisma = {
    patient: { count: jest.fn() },
    labOrder: { count: jest.fn() },
    sample: { count: jest.fn() },
    labTest: { count: jest.fn() },
    testCategory: { count: jest.fn() },
    testResult: { count: jest.fn() },
    labReport: { count: jest.fn() },
  };
  let controller: DashboardController;
  const actor = (role: Role) => ({ role }) as User;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.count.mockResolvedValue(24);
    prisma.labOrder.count.mockResolvedValue(3);
    prisma.sample.count.mockResolvedValue(6);
    prisma.labTest.count.mockResolvedValue(8);
    prisma.testCategory.count.mockResolvedValue(9);
    prisma.testResult.count.mockResolvedValue(10);
    prisma.labReport.count.mockResolvedValue(11);
    controller = new DashboardController(prisma as unknown as PrismaService);
  });

  it.each([Role.OWNER, Role.ADMIN])('%s receives the operational dashboard', async (role) => {
    await expect(controller.getStats(actor(role))).resolves.toEqual({
      totalPatients: 24,
      pendingOrders: 3,
      processingOrders: 3,
      completedOrders: 3,
      pendingSamples: 6,
      collectedSamples: 6,
      totalTests: 8,
      activeCategories: 9,
    });
    expect(prisma.labOrder.count).toHaveBeenCalledWith({ where: { status: OrderStatus.REPORT_READY } });
    expect(prisma.testResult.count).not.toHaveBeenCalled();
    expect(prisma.labReport.count).not.toHaveBeenCalled();
  });

  it('returns only reception workflow counts to receptionists', async () => {
    await expect(controller.getStats(actor(Role.RECEPTIONIST))).resolves.toEqual({
      totalPatients: 24,
      pendingOrders: 3,
      pendingSamples: 6,
    });
    expect(prisma.labTest.count).not.toHaveBeenCalled();
    expect(prisma.testResult.count).not.toHaveBeenCalled();
    expect(prisma.labReport.count).not.toHaveBeenCalled();
  });

  it('returns sample-processing counts to technicians', async () => {
    await expect(controller.getStats(actor(Role.TECHNICIAN))).resolves.toEqual({
      pendingSamples: 6,
      collectedSamples: 6,
      processingSamples: 6,
      processingOrders: 3,
    });
    expect(prisma.patient.count).not.toHaveBeenCalled();
    expect(prisma.testResult.count).not.toHaveBeenCalled();
    expect(prisma.labReport.count).not.toHaveBeenCalled();
  });

  it('returns review queue counts to pathologists without patient or financial data', async () => {
    await expect(controller.getStats(actor(Role.PATHOLOGIST))).resolves.toEqual({
      resultsAwaitingReview: 10,
      reportsAwaitingApproval: 11,
      completedOrders: 3,
    });
    expect(prisma.testResult.count).toHaveBeenCalledWith({
      where: { status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] } },
    });
    expect(prisma.labReport.count).toHaveBeenCalledWith({
      where: { status: ReportStatus.PENDING_APPROVAL },
    });
    expect(prisma.patient.count).not.toHaveBeenCalled();
  });

  it('propagates database errors instead of returning incomplete metrics', async () => {
    const databaseError = new Error('Database unavailable');
    prisma.patient.count.mockRejectedValue(databaseError);
    await expect(controller.getStats(actor(Role.OWNER))).rejects.toBe(databaseError);
  });
});
