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
import { CommentsModule } from '../modules/comments/comments.module';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { FollowsModule } from '../modules/follows/follows.module';
import { LikesModule } from '../modules/likes/likes.module';
import { MediaModule } from '../modules/media/media.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PostsModule } from '../modules/posts/posts.module';
import { SavedPostsModule } from '../modules/saved-posts/saved-posts.module';
import { SearchModule } from '../modules/search/search.module';
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
    LikesModule,
    CommentsModule,
    SavedPostsModule,
    NotificationsModule,
    SearchModule,
    ConversationsModule,
    // A modest workspace-wide default (docs/API.md §1); AuthController
    // overrides this with stricter per-route limits via @Throttle().
    // In-memory storage (the default) — not the Redis-backed storage
    // ARCHITECTURE.md §5.2 anticipates, since that only matters once
    // multiple API instances share rate-limit state, which doesn't exist
    // yet (see docs/PROGRESS.md Milestone 5 deviations). Raised 100→200
    // in Milestone 21: `apps/web-e2e`'s Playwright run uses several
    // parallel workers against one shared dev server/IP, and
    // `critical-path.spec.ts`'s single continuous journey plus Milestone
    // 21's new conversations endpoints/tests pushed real concurrent usage
    // past the previous limit (confirmed by a real `ThrottlerException` on
    // `GET /explore` mid-run) — the same "suite outgrew the limit" pattern
    // every `/auth/*` throttle increase in this project's history has
    // followed, just on the global default this time instead of a
    // per-route one.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 200 }],
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
