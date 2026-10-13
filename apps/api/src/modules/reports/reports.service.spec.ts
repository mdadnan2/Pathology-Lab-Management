import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuditAction, OrderStatus, ReportStatus, ResultStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    labOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    labReport: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const permissionsService = { assertUserPermission: jest.fn().mockResolvedValue(undefined) };
  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const tx = {
      labReport: {
        findUnique: jest.fn().mockResolvedValue({ id: 'report-1', status: ReportStatus.APPROVED }),
        create: jest.fn().mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDING_APPROVAL }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      labOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );
    auditService.log.mockResolvedValue(undefined);
    prisma.labOrder.findMany.mockResolvedValue([]);
    prisma.labOrder.count.mockResolvedValue(0);
    prisma.labReport.updateMany.mockResolvedValue({ count: 1 });
    service = new ReportsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      permissionsService as never,
    );
  });

  it('blocks report generation until every test result is approved', async () => {
    prisma.labOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.APPROVED,
      items: [
        { result: { status: ResultStatus.APPROVED } },
        { result: { status: ResultStatus.UNDER_REVIEW } },
      ],
    });

    await expect(service.generate('order-1', 'pathologist-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('generates a pending-approval report only when every result is approved', async () => {
    prisma.labOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-DEMO-0001',
      status: OrderStatus.APPROVED,
      items: [{ result: { status: ResultStatus.APPROVED } }],
    });
    prisma.labReport.findUnique.mockResolvedValue(null);
    const tx = {
      labReport: {
        create: jest.fn().mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDING_APPROVAL }),
      },
      labOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await service.generate('order-1', 'pathologist-1');

    expect(tx.labReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ReportStatus.PENDING_APPROVAL }),
    }));
    expect(tx.labOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: { not: OrderStatus.CANCELLED } },
      data: { status: OrderStatus.APPROVED },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.REPORT_GENERATED,
      entityId: 'report-1',
    }));
  });

  it('refuses to approve a report that is not pending approval', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      status: ReportStatus.DELIVERED,
    });

    await expect(service.approve('report-1', 'pathologist-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approves a pending report and advances the order', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      orderId: 'order-1',
      status: ReportStatus.PENDING_APPROVAL,
      order: { status: OrderStatus.APPROVED },
    });

    await service.approve('report-1', 'pathologist-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.REPORT_APPROVED,
    }));
  });

  it('prevents a report generator from approving their own report', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      generatedById: 'pathologist-1',
      status: ReportStatus.PENDING_APPROVAL,
      order: { status: OrderStatus.APPROVED },
    });

    await expect(service.approve('report-1', 'pathologist-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('limits receptionist report lists to finalized reports', async () => {
    await service.findAll({
      page: 1,
      limit: 10,
      status: ReportStatus.PENDING_APPROVAL,
      role: Role.RECEPTIONIST,
    });

    expect(prisma.labReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { status: { in: [ReportStatus.APPROVED, ReportStatus.DELIVERED] } },
          { status: ReportStatus.PENDING_APPROVAL },
        ],
      },
    }));
  });

  it('hides unfinalized report detail from receptionists', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      status: ReportStatus.PENDING_APPROVAL,
    });

    await expect(service.findOne('report-1', Role.RECEPTIONIST))
      .rejects.toThrow('Report not found');
  });

  it('prevents approval if another request changed the report status', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      orderId: 'order-1',
      status: ReportStatus.PENDING_APPROVAL,
      order: { status: OrderStatus.APPROVED },
    });
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: {
        labReport: {
          updateMany: jest.Mock;
          findUnique: jest.Mock;
          update: jest.Mock;
        };
        labOrder: { updateMany: jest.Mock };
      }) => Promise<unknown>) => callback({
        labReport: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        labOrder: { updateMany: jest.fn() },
      }),
    );

    await expect(service.approve('report-1', 'pathologist-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('offers only approved orders without existing reports for generation', async () => {
    await service.findEligibleOrders({ page: 1, limit: 10 });

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { not: OrderStatus.CANCELLED },
        report: { is: null },
      }),
    }));
  });

  it('delivers an approved report PDF and records delivery once', async () => {
    prisma.labReport.findUnique.mockResolvedValue({
      id: 'report-1',
      orderId: 'order-1',
      status: ReportStatus.APPROVED,
      generatedAt: new Date('2026-01-02T00:00:00.000Z'),
      approvedAt: new Date('2026-01-02T00:00:00.000Z'),
      approvedBy: { firstName: 'Demo', lastName: 'Pathologist', role: 'PATHOLOGIST' },
      order: {
        orderNumber: 'ORD-DEMO-0001',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        patient: {
          firstName: 'Fictional',
          lastName: 'Patient',
          patientCode: 'PAT-DEMO-0001',
          dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
          gender: 'OTHER',
        },
        items: [{
          testNameSnapshot: 'Demo test',
          result: {
            notes: null,
            parameters: [{
              value: '12',
              unit: 'units',
              isAbnormal: false,
              testParameter: {
                name: 'Demo count',
                referenceRangeLow: '10',
                referenceRangeHigh: '20',
                referenceRangeText: null,
              },
            }],
          },
        }],
      },
    });

    const pdf = await service.download('report-1', 'receptionist-1');

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.labReport.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: ReportStatus.APPROVED },
      data: { status: ReportStatus.DELIVERED },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'receptionist-1',
      action: AuditAction.REPORT_DELIVERED,
    }));
  });
});
