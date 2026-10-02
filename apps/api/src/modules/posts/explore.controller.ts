import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { ExploreResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from './posts.dto';
import { PostsService } from './posts.service';

/**
 * `/explore` (docs/API.md §11) — lives in `PostsModule`, not
 * `ExploreModule`, the same "host it where the data already lives"
 * reasoning `FeedController`/`MeSavedController` already established
 * (Milestones 12/15): it needs `PostsService`'s full post-rendering
 * pipeline, and `PostsModule` already depends on `ExploreModule` one-way
 * (for the ranked id list), so the reverse dependency would be circular.
 */
@ApiTags('explore')
@Controller('explore')
export class ExploreController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Explore posts from accounts you do not follow, ranked by recent engagement.',
  })
  async getExplore(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<ExploreResponse> {
    return this.postsService.getExplore(currentUser.id, query);
  }
}
