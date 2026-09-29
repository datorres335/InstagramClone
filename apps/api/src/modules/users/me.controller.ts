import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { MediaResponse, UserResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateAvatarDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

/**
 * `/me/*` — docs/API.md §4/§13. Grows in Milestone 19 (change-password,
 * change-email, delete-account) — a separate controller from
 * `UsersController` since `/me` and `/users/:username` are distinct
 * resource bases (docs/API.md §2), even though both live in this module.
 */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

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
}
