import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  CommentListResponse,
  CommentResponse,
} from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CreateCommentDto, PaginationQueryDto } from './comments.dto';
import { CommentsService } from './comments.service';

/** `/posts/:postId/comments*` — docs/API.md §9. A separate controller from `PostsController`, matching the domain-module split every other cross-cutting feature uses. */
@ApiTags('comments')
@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a comment to a post.' })
  async create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.commentsService.createComment(currentUser.id, postId, dto);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: "List a post's comments (paginated, oldest-first).",
  })
  async list(
    @Param('postId') postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CommentListResponse> {
    return this.commentsService.getComments(postId, query);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete a comment (the comment author or the post author).',
  })
  async delete(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.commentsService.deleteComment(commentId, currentUser.id);
  }
}
