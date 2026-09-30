import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // MediaModule exports MediaService, used to validate each mediaId is the
  // caller's own, READY, POST_IMAGE-purpose media (docs/API.md §7).
  imports: [AuthModule, MediaModule],
  controllers: [PostsController],
  providers: [PostsService],
  // UsersModule needs getPostsByAuthor for GET /users/:username/posts (the
  // profile grid) — the same dependency shape MediaModule/FollowsModule
  // already established for UsersModule.
  exports: [PostsService],
})
export class PostsModule {}
