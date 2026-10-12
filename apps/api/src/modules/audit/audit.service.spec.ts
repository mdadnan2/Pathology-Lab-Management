import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditEvent: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('writes audit events with their actor and metadata', async () => {
    prisma.auditEvent.create.mockResolvedValue({});

    await service.log({
      actorId: 'user-1',
      action: AuditAction.PATIENT_CREATED,
      entityType: 'Patient',
      entityId: 'patient-1',
      metadata: { source: 'unit-test' },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: AuditAction.PATIENT_CREATED,
        entityType: 'Patient',
        entityId: 'patient-1',
        metadata: { source: 'unit-test' },
      },
    });
  });

  it('applies optional filters and returns pagination metadata', async () => {
    const events = [{ id: 'event-1' }];
    prisma.auditEvent.findMany.mockResolvedValue(events);
    prisma.auditEvent.count.mockResolvedValue(5);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');

    const result = await service.findAll({
      page: 2,
      limit: 2,
      actorId: 'user-1',
      action: AuditAction.PATIENT_CREATED,
      entityType: 'Patient',
      from,
      to,
    });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actorId: 'user-1',
          action: AuditAction.PATIENT_CREATED,
          entityType: 'Patient',
          createdAt: { gte: from, lte: to },
        },
        skip: 2,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: events,
      meta: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });
});
