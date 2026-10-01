import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SavedPostsResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from './posts.dto';
import { PostsService } from './posts.service';

/**
 * `/me/saved` (docs/API.md §10) — lives in `PostsModule`, not
 * `SavedPostsModule`: it needs `PostsService`'s full post-rendering
 * pipeline (`LikesService`/`CommentsService` batching + `toPostResponse`),
 * and `PostsModule` already depends on `SavedPostsModule` for
 * `isSavedByMe`, so the reverse dependency would be circular. The same
 * "host it where the data already lives" reasoning `FeedController`
 * applied for `/feed` (Milestone 12).
 */
@ApiTags('saved-posts')
@Controller('me/saved')
export class MeSavedController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List your own saved posts, newest first.' })
  async getSavedPosts(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<SavedPostsResponse> {
    return this.postsService.getSavedPosts(currentUser.id, query);
  }
}
