import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PostResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import { CreatePostDto } from './posts.dto';
import { PostsService } from './posts.service';

/** `/posts/*` — docs/API.md §7. */
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a post from 1–10 already-uploaded images.' })
  async create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createPost(currentUser.id, dto);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single post.' })
  async getById(
    @Param('id') id: string,
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
  ): Promise<PostResponse> {
    return this.postsService.getById(id, viewer?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete your own post (soft delete).' })
  async delete(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.postsService.deletePost(id, currentUser.id);
  }
}
