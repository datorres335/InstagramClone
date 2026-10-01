import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  // No MediaModule dependency, unlike LikesModule/PostsModule —
  // `comment-response.mapper.ts` calls `resolveAvatarUrl` as a plain
  // exported function, not through an injected `MediaService`, so there's
  // no real DI relationship to declare here.
  imports: [AuthModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  // PostsModule needs getCommentCountForPosts for PostResponse.commentsCount.
  exports: [CommentsService],
})
export class CommentsModule {}
