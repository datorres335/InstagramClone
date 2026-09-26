import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { type ApiEnv } from '@instagram-clone/config';
import { PrismaClient } from '@instagram-clone/prisma-client';

import { API_ENV } from '../config/config.module';

/**
 * DI-provided Prisma Client (docs/ARCHITECTURE.md §5.2). Every domain
 * service gets this injected rather than importing `@instagram-clone/
 * prisma-client` directly, so there is exactly one connection pool per
 * process and one place that owns its lifecycle.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(API_ENV) env: ApiEnv) {
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
