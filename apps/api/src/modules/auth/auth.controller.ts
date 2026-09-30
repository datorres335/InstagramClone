import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type {
  AuthResponse,
  RefreshResponse,
  SessionResponse,
} from '@instagram-clone/validation';
import type { ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../../config/config.module';
import { LoginDto, LogoutDto, RefreshDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { type AuthenticatedUser, JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { InvalidRefreshTokenException } from './auth.exceptions';
import {
  clearRefreshCookie,
  extractRefreshToken,
  setRefreshCookie,
} from './refresh-cookie';
import { extractRequestMeta } from './request-meta';
import { toUserResponse } from '../../common/mappers/user-response.mapper';

/**
 * `/auth/*` — docs/API.md §3. Every route here is versioned/prefixed
 * automatically (`/api/v1/auth/...`) by the global setup in `main.ts`.
 *
 * Throttled more tightly than the workspace default (docs/API.md §1) on the
 * credential-facing routes specifically, to slow credential-stuffing —
 * `session` uses the global default since it's just a token check.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  // Still meaningfully stricter than the workspace default (100/60s) —
  // raised from 10 to 20 in Milestone 9, then to 40 in Milestone 12, both
  // times because `apps/api-e2e`'s register calls are a shared budget across
  // every spec file in one run against one long-lived server process
  // (docs/API.md §1). 20 ran out exactly at capacity (a real 429 on a full
  // suite run, not a projection) once Milestone 12's feed.spec.ts added its
  // 2 registrations on top of an already-exhausted budget — 40 is deliberately
  // generous (2x current usage) rather than the bare minimum, since re-tuning
  // this every single milestone that adds a multi-account test is its own
  // cost; Likes/Comments/SavedPost (Milestones 13–15) will all need fresh
  // accounts too.
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account and start a session.' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, accessToken, accessTokenExpiresAt, refreshToken } =
      await this.authService.register(dto, extractRequestMeta(req));

    setRefreshCookie(res, this.env, refreshToken);

    return {
      user: toUserResponse(user),
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with email/username + password.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, accessToken, accessTokenExpiresAt, refreshToken } =
      await this.authService.login(dto, extractRequestMeta(req));

    setRefreshCookie(res, this.env, refreshToken);

    return {
      user: toUserResponse(user),
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate a refresh token for a new access token.' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const presentedToken = extractRefreshToken(req, dto.refreshToken);
    if (!presentedToken) {
      throw new InvalidRefreshTokenException();
    }

    const { accessToken, accessTokenExpiresAt, refreshToken } =
      await this.authService.refresh(presentedToken, extractRequestMeta(req));

    setRefreshCookie(res, this.env, refreshToken);

    return { accessToken, accessTokenExpiresAt, refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out (or, with allDevices, everywhere).' })
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const presentedToken = extractRefreshToken(req, dto.refreshToken);
    await this.authService.logout(presentedToken, {
      allDevices: dto.allDevices,
    });
    clearRefreshCookie(res, this.env);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Who am I? Cheap auth check used by SSR.' })
  async session(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SessionResponse> {
    const user = await this.authService.getSessionUser(currentUser.id);
    return { user: toUserResponse(user) };
  }
}
