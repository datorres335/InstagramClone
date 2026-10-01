import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { PaginationQuery } from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';

export interface SavedPostIdsPage {
  postIds: string[];
  nextCursor: string | null;
}

@Injectable()
export class SavedPostsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `PUT /posts/:postId/save` (docs/API.md §10) — idempotent, mirrors `Follow`/`Like`'s upsert convention exactly. */
  async save(userId: string, postId: string): Promise<void> {
    await this.findActivePost(postId);
    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  /** `DELETE /posts/:postId/save` (docs/API.md §10) — idempotent either way. */
  async unsave(userId: string, postId: string): Promise<void> {
    await this.findActivePost(postId);
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
  }

  /**
   * `PostResponse.isSavedByMe` (docs/API.md §7) — batched for a whole page
   * of posts (e.g. the feed) in one query, not N; mirrors
   * `LikesService.getLikeStateForPosts`'s null-for-anonymous,
   * real-boolean-for-authenticated convention, minus the count half a save
   * doesn't have.
   */
  async getSavedStateForPosts(
    postIds: string[],
    viewerId: string | undefined,
  ): Promise<Map<string, boolean | null>> {
    if (postIds.length === 0) return new Map();
    if (!viewerId) {
      return new Map(postIds.map((postId) => [postId, null]));
    }

    const saved = await this.prisma.savedPost.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    });
    const savedSet = new Set(saved.map((row) => row.postId));

    return new Map(postIds.map((postId) => [postId, savedSet.has(postId)]));
  }

  /**
   * `GET /me/saved` (docs/API.md §10) — just the paginated list of saved
   * `postId`s, newest-first; `PostsService` turns these into full
   * `PostResponse` items (it already has the `LikesService`/
   * `CommentsService`/`toPostResponse` machinery for that — duplicating it
   * here would mean either a `PostsModule` dependency, which would be
   * circular since `PostsModule` already depends on this module for
   * `isSavedByMe`, or re-implementing the post-rendering pipeline a second
   * time).
   */
  async getSavedPostIdsForViewer(
    viewerId: string,
    query: PaginationQuery,
  ): Promise<SavedPostIdsPage> {
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.savedPost.findMany({
      where: {
        userId: viewerId,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, postId: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: query.limit + 1,
      select: { postId: true, createdAt: true },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.postId })
        : null;

    return { postIds: page.map((row) => row.postId), nextCursor };
  }

  private async findActivePost(postId: string): Promise<void> {
    // Small, self-contained existence check rather than a `PostsModule`
    // dependency — the same trade-off `LikesService`/`CommentsService`
    // already make (Milestones 13/14) for the identical reason: `PostsModule`
    // depends on this module for `isSavedByMe`, so the reverse dependency
    // would be circular regardless.
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
  }

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }
}
