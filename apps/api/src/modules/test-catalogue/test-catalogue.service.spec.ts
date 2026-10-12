import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TestCatalogueService } from './test-catalogue.service';

describe('TestCatalogueService', () => {
  const prisma = {
    testCategory: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    labTest: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    testParameter: { create: jest.fn() },
  };
  const auditService = { log: jest.fn() };
  let service: TestCatalogueService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.log.mockResolvedValue(undefined);
    service = new TestCatalogueService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('rejects duplicate category codes', async () => {
    prisma.testCategory.findUnique.mockResolvedValue({ id: 'category-1' });

    await expect(
      service.createCategory({ code: 'HEM', name: 'Hematology' }, 'owner-1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.testCategory.create).not.toHaveBeenCalled();
  });

  it('creates a test with the requested category and audits the write', async () => {
    prisma.labTest.findUnique.mockResolvedValue(null);
    prisma.testCategory.findUnique.mockResolvedValue({ id: 'category-1' });
    prisma.labTest.create.mockResolvedValue({
      id: 'test-1',
      code: 'CBC',
      price: { toString: () => '350.00' },
    });

    const result = await service.create(
      {
        code: 'CBC',
        name: 'Complete Blood Count',
        categoryId: 'category-1',
        specimenType: 'Blood',
        department: 'Hematology',
        price: 350,
      },
      'owner-1',
    );

    expect(result.id).toBe('test-1');
    expect(prisma.labTest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'category-1',
          turnaroundHours: 24,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TEST_CREATED', entityId: 'test-1' }),
    );
  });

  it('does not create a test when its category does not exist', async () => {
    prisma.labTest.findUnique.mockResolvedValue(null);
    prisma.testCategory.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'CBC',
          name: 'Complete Blood Count',
          categoryId: 'missing',
          specimenType: 'Blood',
          department: 'Hematology',
          price: 350,
        },
        'owner-1',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.labTest.create).not.toHaveBeenCalled();
  });

  it('toggles an existing test and emits the deactivation audit event', async () => {
    prisma.labTest.findUnique.mockResolvedValue({ id: 'test-1', isActive: true });
    prisma.labTest.update.mockResolvedValue({ id: 'test-1', isActive: false });

    await service.toggleActive('test-1', 'owner-1');

    expect(prisma.labTest.update).toHaveBeenCalledWith({
      where: { id: 'test-1' },
      data: { isActive: false },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TEST_DEACTIVATED' }),
    );
  });
});
