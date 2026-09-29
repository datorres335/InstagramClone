import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  // MediaModule exports MediaService, used to resolve each list item's
  // avatarUrl (same dependency shape as UsersModule).
  imports: [AuthModule, MediaModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  // UsersModule needs getFollowCounts/isFollowing for
  // PublicProfileResponse's followersCount/followingCount/isFollowedByMe.
  exports: [FollowsService],
})
export class FollowsModule {}
