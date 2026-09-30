import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FeedResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from './posts.dto';
import { PostsService } from './posts.service';

/**
 * `/feed` (docs/API.md §7) — a top-level resource, not nested under
 * `/posts`, matching the literal `GET /feed` path the docs specify (the
 * resource map predates this milestone and never listed a Feed row; adding
 * one is part of this milestone's doc sync, not a deviation from it).
 */
@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'The authenticated home feed: posts from followed accounts, newest first.',
  })
  async getFeed(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<FeedResponse> {
    return this.postsService.getFeed(currentUser.id, query);
  }
}
