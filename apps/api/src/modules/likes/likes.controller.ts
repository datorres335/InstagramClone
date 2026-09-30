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
import { PaginationQueryDto } from './likes.dto';
import { LikesService } from './likes.service';

/**
 * `/posts/:postId/like*` — docs/API.md §8. A separate controller from
 * `PostsController` (both effectively scoped under `posts`), matching the
 * domain-module split `FollowsController`/`UsersController` already
 * established for the same reason (Milestone 10).
 */
@ApiTags('likes')
@Controller('posts/:postId')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Put('like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like a post (idempotent).' })
  async like(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('postId') postId: string,
  ): Promise<void> {
    await this.likesService.like(currentUser.id, postId);
  }

  @Delete('like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlike a post (idempotent).' })
  async unlike(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('postId') postId: string,
  ): Promise<void> {
    await this.likesService.unlike(currentUser.id, postId);
  }

  @Get('likes')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List who liked a post (paginated).' })
  async getLikers(
    @Param('postId') postId: string,
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<FollowListResponse> {
    return this.likesService.getLikers(postId, viewer?.id, query);
  }
}
