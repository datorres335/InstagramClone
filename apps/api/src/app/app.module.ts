import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import IORedis from 'ioredis';
import { ZodValidationPipe } from 'nestjs-zod';

import type { ApiEnv } from '@instagram-clone/config';

import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { API_ENV, ConfigModule } from '../config/config.module';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FollowsModule } from '../modules/follows/follows.module';
import { MediaModule } from '../modules/media/media.module';
import { PostsModule } from '../modules/posts/posts.module';
import { UsersModule } from '../modules/users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MediaModule,
    FollowsModule,
    PostsModule,
    // A modest workspace-wide default (docs/API.md §1); AuthController
    // overrides this with stricter per-route limits via @Throttle().
    // In-memory storage (the default) — not the Redis-backed storage
    // ARCHITECTURE.md §5.2 anticipates, since that only matters once
    // multiple API instances share rate-limit state, which doesn't exist
    // yet (see docs/PROGRESS.md Milestone 5 deviations).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    // Shared Redis connection for every BullMQ queue (just `media` today —
    // docs/ARCHITECTURE.md §8). `maxRetriesPerRequest: null` is required by
    // BullMQ's blocking connection usage, not optional tuning.
    BullModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      }),
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
