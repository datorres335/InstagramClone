import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CommentListResponse,
  CommentResponse,
  CreateCommentInput,
  PaginationQuery,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toCommentResponse } from './comment-response.mapper';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * `POST /posts/:postId/comments` (docs/API.md §9) — flat only; the body
   * never accepts a `parentCommentId`. Every call creates a genuinely new
   * row (unlike `like`/`follow`, there's no idempotent-repeat case to guard
   * against), so the notification is enqueued unconditionally —
   * `NotificationsService.enqueueNotification` itself still skips it if the
   * commenter is the post's own author.
   */
  async createComment(
    authorId: string,
    postId: string,
    input: CreateCommentInput,
  ): Promise<CommentResponse> {
    const post = await this.findActivePost(postId);
    const comment = await this.prisma.comment.create({
      data: { postId, authorId, body: input.body },
      include: { author: { include: { avatarMedia: true } } },
    });

    await this.notificationsService.enqueueNotification({
      recipientId: post.authorId,
      actorId: authorId,
      type: 'COMMENT',
      postId,
      commentId: comment.id,
    });

    return toCommentResponse(comment, this.storage);
  }

  /** `GET /posts/:postId/comments` (docs/API.md §9) — oldest-first, the one paginated list in this codebase that isn't newest-first. */
  async getComments(
    postId: string,
    query: PaginationQuery,
  ): Promise<CommentListResponse> {
    await this.findActivePost(postId);
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
        ...(decoded && {
          OR: [
            { createdAt: { gt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { gt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      include: { author: { include: { avatarMedia: true } } },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    const data: CommentResponse[] = page.map((comment) =>
      toCommentResponse(comment, this.storage),
    );

    return { data, meta: { nextCursor } };
  }

  /** `DELETE /posts/:postId/comments/:commentId` (docs/API.md §9) — the comment author OR the post's author may delete it. */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: { post: { select: { authorId: true } } },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    if (comment.authorId !== userId && comment.post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own comments, or comments on your own posts.',
      );
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * `PostResponse.commentsCount` (docs/API.md §7) — batched for a whole page
   * of posts (e.g. the feed) in one query, not N; mirrors
   * `LikesService.getLikeStateForPosts`'s shape (Milestone 13), minus the
   * per-viewer dimension a comment count doesn't need.
   */
  async getCommentCountForPosts(
    postIds: string[],
  ): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();

    const counts = await this.prisma.comment.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, deletedAt: null },
      _count: true,
    });
    const countByPostId = new Map(
      counts.map((row) => [row.postId, row._count]),
    );

    return new Map(
      postIds.map((postId) => [postId, countByPostId.get(postId) ?? 0]),
    );
  }

  private async findActivePost(
    postId: string,
  ): Promise<{ id: string; authorId: string }> {
    // Small, self-contained existence check rather than a `PostsModule`
    // dependency — the same trade-off `LikesService` already makes
    // (Milestone 13) for the identical reason: `PostsModule` depends on
    // `CommentsModule` for `commentsCount`, so the reverse dependency would
    // be circular regardless. Now also returns `authorId` (Milestone 16) —
    // the comment notification's recipient.
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    return post;
  }

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }
}
