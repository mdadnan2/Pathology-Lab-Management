import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuditAction, OrderStatus, ReportStatus, ResultStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    labOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    labReport: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const tx = {
      labReport: { update: jest.fn().mockResolvedValue({ id: 'report-1' }) },
      labOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );
    auditService.log.mockResolvedValue(undefined);
    service = new ReportsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
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
    expect(prisma.labReport.create).not.toHaveBeenCalled();
  });

  it('generates a pending-approval report only when every result is approved', async () => {
    prisma.labOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-DEMO-0001',
      status: OrderStatus.APPROVED,
      items: [{ result: { status: ResultStatus.APPROVED } }],
    });
    prisma.labReport.findUnique.mockResolvedValue(null);
    prisma.labReport.create.mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDING_APPROVAL });

    await service.generate('order-1', 'pathologist-1');

    expect(prisma.labReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ReportStatus.PENDING_APPROVAL }),
    }));
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
    expect(prisma.labReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { status: ReportStatus.DELIVERED },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'receptionist-1',
      action: AuditAction.REPORT_DELIVERED,
    }));
  });
});
