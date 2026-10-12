import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('reports the API and database as ready when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue(1);

    const result = await service.check();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.data.status).toBe('ok');
    expect(result.data.database).toBe('connected');
    expect(result.data.timestamp).toEqual(expect.any(String));
  });

  it('returns service unavailable when the database check fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
