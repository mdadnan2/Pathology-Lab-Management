import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new ServiceUnavailableException('Database is unavailable', {
        cause: error,
      });
    }

    return {
      data: {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
