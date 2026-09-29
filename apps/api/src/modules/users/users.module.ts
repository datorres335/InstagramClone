import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FollowsModule } from '../follows/follows.module';
import { MediaModule } from '../media/media.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AuthModule exports JwtAuthGuard/OptionalAuthGuard (and the JwtModule
  // they depend on) — imported here rather than each guard being
  // reconstructed with its own JwtModule copy. MediaModule exports
  // MediaService, used to resolve `avatarUrl` and to drive `PATCH
  // /me/avatar` (docs/API.md §4). FollowsModule exports FollowsService, used
  // to resolve `followersCount`/`followingCount`/`isFollowedByMe`.
  imports: [AuthModule, MediaModule, FollowsModule],
  controllers: [UsersController, MeController],
  providers: [UsersService],
})
export class UsersModule {}
