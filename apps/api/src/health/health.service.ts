import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResult {
  status: 'ok';
  database: 'up';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A "deep" check (does the database actually respond), not just "is the
   * process alive" — a 200 here is meaningful evidence the Milestone 4
   * Prisma DI wiring genuinely works, not just that Node is running.
   */
  async check(): Promise<HealthCheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : error,
      );
      throw new ServiceUnavailableException('Database is unreachable');
    }

    return { status: 'ok', database: 'up' };
  }
}
