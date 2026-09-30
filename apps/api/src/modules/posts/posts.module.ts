import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { FeedController } from './feed.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // MediaModule exports MediaService, used to validate each mediaId is the
  // caller's own, READY, POST_IMAGE-purpose media (docs/API.md §7).
  imports: [AuthModule, MediaModule],
  // FeedController lives here rather than its own module — `GET /feed`
  // (Milestone 12) is a top-level resource by URL, but it's really just
  // another read path over PostsService, with no state or dependencies of
  // its own that would justify a separate module.
  controllers: [PostsController, FeedController],
  providers: [PostsService],
  // UsersModule needs getPostsByAuthor for GET /users/:username/posts (the
  // profile grid) — the same dependency shape MediaModule/FollowsModule
  // already established for UsersModule.
  exports: [PostsService],
})
export class PostsModule {}
