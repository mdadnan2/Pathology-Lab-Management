import { ForbiddenException } from '@nestjs/common';
import { AuditAction, PermissionEventType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from './permission-policy';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    userPermissionEvent: { findMany: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: PermissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userPermissionEvent.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        role: ({
          'owner-1': Role.OWNER,
          'admin-1': Role.ADMIN,
          'receptionist-1': Role.RECEPTIONIST,
          'technician-1': Role.TECHNICIAN,
          'pathologist-1': Role.PATHOLOGIST,
        } as Record<string, Role>)[where.id] ?? Role.TECHNICIAN,
        isActive: true,
      }),
    );
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: Role.TECHNICIAN });
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  it.each([
    ['owner-1', Role.OWNER, true, true],
    ['admin-1', Role.ADMIN, true, true],
    ['receptionist-1', Role.RECEPTIONIST, true, false],
    ['technician-1', Role.TECHNICIAN, true, true],
    ['pathologist-1', Role.PATHOLOGIST, true, false],
  ] as const)(
    'enforces dashboard and sample-status defaults for %s',
    async (userId, role, canViewDashboard, canUpdateSamples) => {
      const permissions = await service.getPermissions(userId, role);
      expect(permissions.includes(PERMISSIONS.DASHBOARD_VIEW)).toBe(canViewDashboard);
      expect(permissions.includes(PERMISSIONS.SAMPLES_UPDATE_STATUS)).toBe(canUpdateSamples);
    },
  );

  it('applies the latest append-only event over role defaults', async () => {
    prisma.userPermissionEvent.findMany.mockResolvedValue([
      { permission: PERMISSIONS.REPORTS_VIEW, eventType: PermissionEventType.GRANTED },
      { permission: PERMISSIONS.RESULTS_VIEW, eventType: PermissionEventType.REVOKED },
      { permission: PERMISSIONS.RESULTS_VIEW, eventType: PermissionEventType.GRANTED },
    ]);

    const permissions = await service.getPermissions('tech-1', Role.TECHNICIAN);

    expect(permissions).toContain(PERMISSIONS.REPORTS_VIEW);
    expect(permissions).not.toContain(PERMISSIONS.RESULTS_VIEW);
    expect(permissions).toContain(PERMISSIONS.RESULTS_ENTER);
    expect(prisma.userPermissionEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sequence: 'desc' } }),
    );
  });

  it('writes a permission event and audit event when granting an exception', async () => {
    await service.grant(
      'tech-1',
      PERMISSIONS.REPORTS_GENERATE,
      'owner-1',
      'Qualified for reporting',
    );

    expect(prisma.userPermissionEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'tech-1',
        actorId: 'owner-1',
        permission: PERMISSIONS.REPORTS_GENERATE,
        eventType: PermissionEventType.GRANTED,
        reason: 'Qualified for reporting',
      },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.PERMISSION_GRANTED,
          entityId: 'tech-1',
        }),
      }),
    );
  });

  it('blocks self-grants and whitespace-only reasons', async () => {
    await expect(
      service.grant('owner-1', PERMISSIONS.REPORTS_GENERATE, 'owner-1', 'Valid reason'),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.grant('tech-1', PERMISSIONS.REPORTS_GENERATE, 'owner-1', '     '),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.userPermissionEvent.create).not.toHaveBeenCalled();
  });

  it('denies clinical operations that are not in a user role or exception grant', async () => {
    await expect(
      service.assertUserPermission('tech-1', PERMISSIONS.REPORTS_APPROVE),
    ).rejects.toThrow(ForbiddenException);
  });
});
