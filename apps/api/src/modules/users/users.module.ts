import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AuthModule exports JwtAuthGuard/OptionalAuthGuard (and the JwtModule
  // they depend on) — imported here rather than each guard being
  // reconstructed with its own JwtModule copy. MediaModule exports
  // MediaService, used to resolve `avatarUrl` and to drive `PATCH
  // /me/avatar` (docs/API.md §4).
  imports: [AuthModule, MediaModule],
  controllers: [UsersController, MeController],
  providers: [UsersService],
})
export class UsersModule {}
