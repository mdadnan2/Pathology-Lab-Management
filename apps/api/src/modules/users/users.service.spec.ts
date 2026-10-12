import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

describe('UsersService role boundaries', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('prevents an ADMIN from creating an OWNER account', async () => {
    const dto: CreateUserDto = {
      firstName: 'Demo',
      lastName: 'Owner',
      email: 'owner@pathlab.demo',
      phone: '9990000001',
      password: 'temporary-demo-password',
      role: Role.OWNER,
    };

    await expect(service.create(dto, 'admin-id', Role.ADMIN)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from creating another ADMIN account', async () => {
    const dto: CreateUserDto = {
      firstName: 'Demo',
      lastName: 'Manager',
      email: 'admin@pathlab.demo',
      phone: '9990000002',
      password: 'temporary-demo-password',
      role: Role.ADMIN,
    };

    await expect(service.create(dto, 'admin-id', Role.ADMIN)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from promoting an account to OWNER', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-id',
      role: Role.RECEPTIONIST,
    });

    await expect(
      service.update(
        'staff-id',
        { role: Role.OWNER } as UpdateUserDto,
        'admin-id',
        Role.ADMIN,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from deactivating another ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'other-admin',
      role: Role.ADMIN,
    });

    await expect(
      service.deactivate('other-admin', 'admin-id', Role.ADMIN),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from resetting another ADMIN password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'other-admin',
      role: Role.ADMIN,
    });

    await expect(
      service.resetPassword('other-admin', 'admin-id', Role.ADMIN),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('issues a hashed one-time password and requires a change at sign-in', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-id',
      role: Role.TECHNICIAN,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.resetPassword(
      'staff-id',
      'admin-id',
      Role.ADMIN,
    );

    expect(result.temporaryPassword).toHaveLength(24);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-id' },
        data: expect.objectContaining({
          mustChangePassword: true,
          passwordHash: expect.not.stringMatching(result.temporaryPassword),
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_RESET' }),
    );
  });
});
