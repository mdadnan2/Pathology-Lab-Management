import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TestPackagesService } from './test-packages.service';

describe('TestPackagesService', () => {
  const prisma = {
    testPackage: { findUnique: jest.fn(), create: jest.fn() },
    labTest: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  let service: TestPackagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.log.mockResolvedValue(undefined);
    service = new TestPackagesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('creates a package only from active catalogue tests', async () => {
    prisma.testPackage.findUnique.mockResolvedValue(null);
    prisma.labTest.findMany.mockResolvedValue([{ id: 'test-1' }, { id: 'test-2' }]);
    prisma.testPackage.create.mockResolvedValue({ id: 'package-1' });

    await service.create(
      { name: 'Demo panel', price: 500, testIds: ['test-1', 'test-2'] },
      'owner-1',
    );

    expect(prisma.labTest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['test-1', 'test-2'] }, isActive: true },
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PACKAGE_CREATED' }),
    );
  });

  it('rejects duplicate package names', async () => {
    prisma.testPackage.findUnique.mockResolvedValue({ id: 'existing-package' });

    await expect(
      service.create({ name: 'Demo panel', price: 500, testIds: ['test-1'] }, 'owner-1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.testPackage.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate test IDs on package update', async () => {
    prisma.testPackage.findUnique.mockResolvedValue({ id: 'package-1' });

    await expect(
      service.update(
        'package-1',
        { testIds: ['test-1', 'test-1'] },
        'owner-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects package updates that include inactive or missing tests', async () => {
    prisma.testPackage.findUnique.mockResolvedValue({ id: 'package-1' });
    prisma.labTest.findMany.mockResolvedValue([]);

    await expect(
      service.update('package-1', { testIds: ['inactive-test'] }, 'owner-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
