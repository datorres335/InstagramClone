import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type {
  MediaResponse,
  RefreshResponse,
  UserResponse,
} from '@instagram-clone/validation';
import type { ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../../config/config.module';
import { AuthService } from '../auth/auth.service';
import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { extractRequestMeta } from '../auth/request-meta';
import { clearRefreshCookie, setRefreshCookie } from '../auth/refresh-cookie';
import { toUserResponse } from '../../common/mappers/user-response.mapper';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateAvatarDto,
  UpdateProfileDto,
} from './users.dto';
import { UsersService } from './users.service';

/**
 * `/me/*` — docs/API.md §4/§13. Grew in Milestone 19 (change-password,
 * change-email, delete-account) — a separate controller from
 * `UsersController` since `/me` and `/users/:username` are distinct
 * resource bases (docs/API.md §2), even though both live in this module.
 * The three new routes delegate to `AuthService` (now exported from
 * `AuthModule`), not `UsersService` — they need `PasswordService`/
 * `TokensService`, both of which `AuthService` already composes, rather
 * than duplicating that wiring here.
 */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update your own profile.' })
  async updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    return this.usersService.updateOwnProfile(currentUser.id, dto);
  }

  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Set your avatar to an already-uploaded, READY, AVATAR-purpose media.',
  })
  async updateAvatar(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateAvatarDto,
  ): Promise<MediaResponse> {
    return this.usersService.setAvatar(currentUser.id, dto.mediaId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Change your password. Invalidates every other session; the ' +
      'response carries a fresh token pair for this one.',
  })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const tokens = await this.authService.changePassword(
      currentUser.id,
      dto,
      extractRequestMeta(req),
    );
    setRefreshCookie(res, this.env, tokens.refreshToken);
    return tokens;
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change your email (requires currentPassword).' })
  async changeEmail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangeEmailDto,
  ): Promise<UserResponse> {
    const user = await this.authService.changeEmail(currentUser.id, dto);
    return toUserResponse(user);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete your account (soft delete). Revokes every session; ' +
      'requires currentPassword.',
  })
  async deleteAccount(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.deleteAccount(currentUser.id, dto);
    clearRefreshCookie(res, this.env);
  }
}
