import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FollowListResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import { PaginationQueryDto } from './follows.dto';
import { FollowsService } from './follows.service';

/**
 * `/users/:username/follow*` — docs/API.md §5. A separate controller from
 * `UsersController` (both `@Controller('users')`) matching the domain-module
 * split every other cross-cutting feature uses, not a new pattern.
 */
@ApiTags('follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Put(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Follow a user (idempotent).' })
  async follow(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('username') username: string,
  ): Promise<void> {
    await this.followsService.follow(currentUser.id, username);
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfollow a user (idempotent).' })
  async unfollow(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('username') username: string,
  ): Promise<void> {
    await this.followsService.unfollow(currentUser.id, username);
  }

  @Get(':username/followers')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "List a user's followers (paginated)." })
  async getFollowers(
    @Param('username') username: string,
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<FollowListResponse> {
    return this.followsService.getFollowers(username, viewer?.id, query);
  }

  @Get(':username/following')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List who a user follows (paginated).' })
  async getFollowing(
    @Param('username') username: string,
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<FollowListResponse> {
    return this.followsService.getFollowing(username, viewer?.id, query);
  }
}
