import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuditAction, OrderItemStatus, OrderStatus, ResultStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ResultsService } from './results.service';

describe('ResultsService', () => {
  const prisma = {
    labOrderItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findManyStatuses: jest.fn(),
      count: jest.fn(),
    },
    testResult: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    resultParameter: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    labOrder: { update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const permissionsService = { assertUserPermission: jest.fn().mockResolvedValue(undefined) };
  let service: ResultsService;

  const item = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-1',
    status: OrderItemStatus.PROCESSING,
    orderId: 'order-1',
    order: { id: 'order-1', status: OrderStatus.PROCESSING },
    labTest: {
      parameters: [{
        id: 'parameter-1',
        name: 'Demo count',
        unit: 'units',
        referenceRangeLow: new Decimal(10),
        referenceRangeHigh: new Decimal(20),
      }],
    },
    result: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const tx = {
      testResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'result-1' }),
        update: jest.fn().mockResolvedValue({ id: 'result-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      resultParameter: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      labOrderItem: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ status: OrderItemStatus.APPROVED }]),
      },
      labOrder: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );
    prisma.labOrderItem.findUnique.mockResolvedValue(item());
    prisma.testResult.findUnique.mockResolvedValue(null);
    auditService.log.mockResolvedValue(undefined);
    service = new ResultsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      permissionsService as never,
    );
  });

  it('calculates abnormal flags on the server from configured ranges', async () => {
    const tx = {
      testResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'result-1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      resultParameter: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      labOrderItem: { update: jest.fn(), findMany: jest.fn() },
      labOrder: { updateMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (context: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tx.testResult.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'result-1', parameters: [] });

    await service.saveDraft('item-1', {
      parameters: [{ testParameterId: 'parameter-1', value: '25' }],
    }, 'technician-1');

    expect(tx.resultParameter.createMany).toHaveBeenCalledWith({
      data: [{
        testResultId: 'result-1',
        testParameterId: 'parameter-1',
        value: '25',
        unit: 'units',
        isAbnormal: true,
      }],
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESULT_ENTERED,
      actorId: 'technician-1',
    }));
  });

  it('rejects values for parameters from another test', async () => {
    await expect(service.saveDraft('item-1', {
      parameters: [{ testParameterId: 'different-test-parameter', value: '25' }],
    }, 'technician-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow a submitted result to be edited before review', async () => {
    prisma.labOrderItem.findUnique.mockResolvedValue(item({
      result: { id: 'result-1', status: ResultStatus.SUBMITTED },
    }));
    await expect(service.saveDraft('item-1', {
      parameters: [{ testParameterId: 'parameter-1', value: '15' }],
    }, 'technician-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('limits Technician result listings to their own results plus unentered items', async () => {
    await service.findAll({
      page: 1,
      limit: 10,
      actorId: 'technician-1',
      isTechnician: true,
    });

    expect(prisma.labOrderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { result: { is: null } },
          { result: { is: { enteredById: 'technician-1' } } },
        ],
      }),
    }));
  });

  it('requires all configured parameters before submission', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      status: ResultStatus.DRAFT,
      parameters: [],
      orderItem: {
        id: 'item-1',
        order: { status: OrderStatus.PROCESSING },
        labTest: { parameters: [{ id: 'parameter-1' }] },
      },
    });
    await expect(service.submit('result-1', 'tech-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('submits complete draft results with a conditional state update', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      status: ResultStatus.DRAFT,
      parameters: [{ testParameterId: 'parameter-1', value: '15' }],
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
        labTest: { parameters: [{ id: 'parameter-1' }] },
      },
    });
    const tx = {
      testResult: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'result-1' }),
      },
      labOrderItem: { update: jest.fn().mockResolvedValue({}) },
      labOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await service.submit('result-1', 'technician-1');

    expect(tx.testResult.updateMany).toHaveBeenCalledWith({
      where: { id: 'result-1', enteredById: 'technician-1', status: ResultStatus.DRAFT },
      data: { status: ResultStatus.SUBMITTED, rejectionReason: null },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESULT_SUBMITTED,
    }));
  });

  it('requires results to enter review before approval', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      status: ResultStatus.SUBMITTED,
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
      },
    });
    await expect(service.review('result-1', { status: 'APPROVED' }, 'pathologist-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents an entered result from being reviewed by the same staff member', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      enteredById: 'pathologist-1',
      status: ResultStatus.UNDER_REVIEW,
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
      },
    });

    await expect(
      service.review('result-1', { status: 'APPROVED' }, 'pathologist-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a rejection reason', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      status: ResultStatus.UNDER_REVIEW,
      orderItemId: 'item-1',
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
      },
    });
    await expect(service.review('result-1', { status: 'REJECTED' }, 'pathologist-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approves an under-review result and marks its order item approved', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      status: ResultStatus.UNDER_REVIEW,
      orderItemId: 'item-1',
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
      },
    });
    const tx = {
      testResult: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'result-1' }),
      },
      labOrderItem: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ status: OrderItemStatus.APPROVED }]),
      },
      labOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await service.review('result-1', { status: 'APPROVED' }, 'pathologist-1');

    expect(tx.testResult.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'result-1', status: ResultStatus.UNDER_REVIEW },
    }));
    expect(tx.labOrderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { status: OrderItemStatus.APPROVED },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESULT_APPROVED,
      entityId: 'result-1',
    }));
  });

  it('prevents a technician from overwriting another technician\'s draft', async () => {
    prisma.labOrderItem.findUnique.mockResolvedValue(item({
      result: { id: 'result-1', enteredById: 'technician-1', status: ResultStatus.DRAFT },
    }));

    await expect(service.saveDraft('item-1', {
      parameters: [{ testParameterId: 'parameter-1', value: '12' }],
    }, 'technician-2')).rejects.toThrow('You can only edit your own draft or rejected result');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents a technician from submitting another technician\'s draft', async () => {
    prisma.testResult.findUnique.mockResolvedValue({
      id: 'result-1',
      enteredById: 'technician-1',
      status: ResultStatus.DRAFT,
      parameters: [{ testParameterId: 'parameter-1', value: '15' }],
      orderItem: {
        id: 'item-1',
        orderId: 'order-1',
        order: { status: OrderStatus.PROCESSING },
        labTest: { parameters: [{ id: 'parameter-1' }] },
      },
    });

    await expect(service.submit('result-1', 'technician-2'))
      .rejects.toThrow('You can only submit your own draft result');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
