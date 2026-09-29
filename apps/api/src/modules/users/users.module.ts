import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AuthModule exports JwtAuthGuard/OptionalAuthGuard (and the JwtModule
  // they depend on) — imported here rather than each guard being
  // reconstructed with its own JwtModule copy.
  imports: [AuthModule],
  controllers: [UsersController, MeController],
  providers: [UsersService],
})
export class UsersModule {}
