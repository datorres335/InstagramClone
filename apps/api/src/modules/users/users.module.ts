import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FollowsModule } from '../follows/follows.module';
import { MediaModule } from '../media/media.module';
import { PostsModule } from '../posts/posts.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AuthModule exports JwtAuthGuard/OptionalAuthGuard (and the JwtModule
  // they depend on) — imported here rather than each guard being
  // reconstructed with its own JwtModule copy — and, as of Milestone 19,
  // AuthService itself, which MeController's change-password/change-email/
  // delete-account routes call directly. MediaModule exports
  // MediaService, used to resolve `avatarUrl` and to drive `PATCH
  // /me/avatar` (docs/API.md §4). FollowsModule exports FollowsService, used
  // to resolve `followersCount`/`followingCount`/`isFollowedByMe`. PostsModule
  // exports PostsService, used for the profile grid (`GET
  // /users/:username/posts`, real as of Milestone 11).
  imports: [AuthModule, MediaModule, FollowsModule, PostsModule],
  controllers: [UsersController, MeController],
  providers: [UsersService],
})
export class UsersModule {}
