import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SavedPostsService } from './saved-posts.service';

/**
 * `/posts/:postId/save` — docs/API.md §10. A separate controller from
 * `PostsController` (both effectively scoped under `posts`), matching the
 * domain-module split `LikesController`/`CommentsController` already
 * established. `GET /me/saved` lives in `PostsModule` instead
 * (`apps/api/src/modules/posts/me-saved.controller.ts`) — it needs
 * `PostsService`'s full post-rendering pipeline, and `PostsModule` already
 * depends on this module for `isSavedByMe`, so the reverse dependency here
 * would be circular.
 */
@ApiTags('saved-posts')
@Controller('posts/:postId')
export class SavedPostsController {
  constructor(private readonly savedPostsService: SavedPostsService) {}

  @Put('save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save a post (idempotent).' })
  async save(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('postId') postId: string,
  ): Promise<void> {
    await this.savedPostsService.save(currentUser.id, postId);
  }

  @Delete('save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unsave a post (idempotent).' })
  async unsave(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('postId') postId: string,
  ): Promise<void> {
    await this.savedPostsService.unsave(currentUser.id, postId);
  }
}
