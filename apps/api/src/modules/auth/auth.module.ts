import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type ms from 'ms';

import type { ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../../config/config.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';

const JwtModuleConfigured = JwtModule.registerAsync({
  inject: [API_ENV],
  useFactory: (env: ApiEnv) => ({
    secret: env.JWT_ACCESS_TOKEN_SECRET,
    signOptions: { expiresIn: env.JWT_ACCESS_TOKEN_TTL as ms.StringValue },
  }),
});

@Module({
  imports: [JwtModuleConfigured],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    PasswordService,
    JwtAuthGuard,
    OptionalAuthGuard,
  ],
  // Both guards are reused by later milestones' controllers (PATCH /me,
  // GET /users/:username, POST /posts, ...) — exported so those modules
  // don't need to re-import JwtModule just to construct their own copy.
  // JwtModule itself must be re-exported too: when a consuming module's
  // controller does `@UseGuards(OptionalAuthGuard)`, Nest constructs that
  // guard fresh in the *consuming* module's injector context, so JwtService
  // (one of the guard's own constructor params) needs to be resolvable
  // there too — exporting only the guard classes isn't sufficient.
  exports: [JwtAuthGuard, OptionalAuthGuard, JwtModuleConfigured],
})
export class AuthModule {}
