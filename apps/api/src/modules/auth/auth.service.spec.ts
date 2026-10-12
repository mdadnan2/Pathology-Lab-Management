import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService.changePassword', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as never,
      auditService as unknown as AuditService,
    );
  });

  it('requires the correct current password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-id',
      isActive: true,
      passwordHash: await bcrypt.hash('current-password', 12),
    });

    await expect(
      service.changePassword('staff-id', {
        currentPassword: 'wrong-password',
        newPassword: 'new-password-value',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('requires a new password and clears the forced-change flag', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-id',
      isActive: true,
      passwordHash: await bcrypt.hash('current-password', 12),
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.changePassword('staff-id', {
      currentPassword: 'current-password',
      newPassword: 'a-different-password',
    });

    expect(result.message).toBe('Password changed successfully');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-id' },
        data: expect.objectContaining({ mustChangePassword: false }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_CHANGED' }),
    );
  });

  it('rejects reusing the current password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-id',
      isActive: true,
      passwordHash: await bcrypt.hash('current-password', 12),
    });

    await expect(
      service.changePassword('staff-id', {
        currentPassword: 'current-password',
        newPassword: 'current-password',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
