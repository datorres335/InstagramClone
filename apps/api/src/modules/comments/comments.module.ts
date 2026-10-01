import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  // No MediaModule dependency, unlike LikesModule/PostsModule —
  // `comment-response.mapper.ts` calls `resolveAvatarUrl` as a plain
  // exported function, not through an injected `MediaService`, so there's
  // no real DI relationship to declare here. NotificationsModule exports
  // NotificationsService, used to enqueue the "someone commented on your
  // post" notification (Milestone 16) — one-way, not circular.
  imports: [AuthModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  // PostsModule needs getCommentCountForPosts for PostResponse.commentsCount.
  exports: [CommentsService],
})
export class CommentsModule {}
