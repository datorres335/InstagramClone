import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  // MediaModule exports MediaService, used to resolve each liker's
  // avatarUrl (same dependency shape as FollowsModule). NotificationsModule
  // exports NotificationsService, used to enqueue the "someone liked your
  // post" notification (Milestone 16) — one-way, not circular.
  imports: [AuthModule, MediaModule, NotificationsModule],
  controllers: [LikesController],
  providers: [LikesService],
  // PostsModule needs getLikeStateForPosts for PostResponse's
  // likesCount/isLikedByMe (createPost/getById/getFeed).
  exports: [LikesService],
})
export class LikesModule {}
