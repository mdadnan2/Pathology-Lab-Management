import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService login and profile', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwtService = { sign: jest.fn() };
  const auditService = { log: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.sign.mockReturnValue('signed-token');
    auditService.log.mockResolvedValue(undefined);
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as never,
      auditService as unknown as AuditService,
    );
  });

  it('rejects missing or inactive staff accounts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'demo@example.test', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns the login profile without the password hash and audits login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.test',
      role: 'OWNER',
      isActive: true,
      passwordHash: await bcrypt.hash('temporary-password', 4),
    });

    const result = await service.login({
      email: 'owner@example.test',
      password: 'temporary-password',
    });

    expect(result.token).toBe('signed-token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'owner-1', role: 'OWNER' }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_LOGIN', actorId: 'owner-1' }),
    );
  });

  it('returns the profile requested by the authenticated user ID', async () => {
    const profile = { id: 'owner-1', role: 'OWNER', passwordHash: 'secret-hash' };
    prisma.user.findUnique.mockResolvedValue(profile);

    const result = await service.getProfile('owner-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.role).toBe('OWNER');
  });
});
