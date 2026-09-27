import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type ms from 'ms';

import type { ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../../config/config.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        secret: env.JWT_ACCESS_TOKEN_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TOKEN_TTL as ms.StringValue },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService, PasswordService, JwtAuthGuard],
  // JwtAuthGuard is reused by later milestones' controllers (PATCH /me,
  // POST /posts, ...) — exported so those modules don't need to re-import
  // JwtModule just to construct their own copy.
  exports: [JwtAuthGuard],
})
export class AuthModule {}
