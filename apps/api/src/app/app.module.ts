import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ConfigModule } from '../config/config.module';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    // A modest workspace-wide default (docs/API.md §1); AuthController
    // overrides this with stricter per-route limits via @Throttle().
    // In-memory storage (the default) — not the Redis-backed storage
    // ARCHITECTURE.md §5.2 anticipates, since that only matters once
    // multiple API instances share rate-limit state, which doesn't exist
    // yet (see docs/PROGRESS.md Milestone 5 deviations).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
  ],
  providers: [
    // Validates every @Body()/@Query()/@Param() against the Zod schema its
    // DTO was created from (createZodDto, from packages/validation) —
    // see docs/ARCHITECTURE.md §5.2. First exercised for real by
    // Milestone 5's auth endpoints.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Turns every thrown exception (Zod validation failures included) into
    // the RFC 7807 Problem Details shape docs/API.md §1 specifies.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
