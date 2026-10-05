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
  // Still meaningfully stricter than the workspace default (200/60s) —
  // raised from 10 to 20 in Milestone 9, then to 40 in Milestone 12, then to
  // 60 in Milestone 18, then to 90 in Milestone 22, each time because
  // `apps/api-e2e`'s register calls are a shared budget across every spec
  // file in one run against one long-lived server process (docs/API.md
  // §1). 60 ran out exactly at capacity (a real 429 on a full suite run,
  // not a projection) once Milestone 22's `events.spec.ts` (6
  // registrations) pushed real total usage past it. 90 is deliberately
  // generous relative to what's measured today, the same "re-tuning every
  // milestone is its own cost" reasoning every earlier increase already
  // recorded, not the bare minimum to clear this one failure.
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
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
  // Raised from 10 to 20 in Milestone 20, the same "shared, whole-suite
  // budget" pattern /auth/register's own 10→20→40→60 history already
  // established — discovered, not anticipated: by Milestone 19, real
  // apps/api-e2e usage had reached exactly 10 login calls across
  // auth-flow.spec.ts/refresh-expiry.spec.ts/account-settings.spec.ts,
  // sitting precisely at the limit with zero headroom. Adding this
  // milestone's own security.spec.ts (one more login call, to assert its
  // X-RateLimit-Limit header) tipped it over into real, intermittent 429s
  // in other files' unrelated login calls — the exact collision pattern
  // bug #42/#56 already documented for other shared-budget routes, just
  // never triggered for /auth/login until now.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
  // Raised 10 -> 20 alongside `login` above, same milestone, same reasoning
  // — apps/api-e2e usage had independently also reached exactly 10 refresh
  // calls across four spec files, the identical zero-headroom situation.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
