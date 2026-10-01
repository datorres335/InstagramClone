import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  FollowListItem,
  FollowListResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface LikeState {
  likesCount: number;
  isLikedByMe: boolean | null;
}

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * `PUT /posts/:postId/like` (docs/API.md §8) — idempotent, mirrors
   * `Follow`'s upsert convention exactly. The notification is only enqueued
   * on a genuine new like (checked before the upsert), not on every repeat
   * idempotent call — otherwise re-liking a post you already liked would
   * spam the post's author with duplicate notifications.
   */
  async like(userId: string, postId: string): Promise<void> {
    const post = await this.findActivePost(postId);
    const alreadyLiked = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { userId: true },
    });

    await this.prisma.like.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    if (!alreadyLiked) {
      await this.notificationsService.enqueueNotification({
        recipientId: post.authorId,
        actorId: userId,
        type: 'LIKE',
        postId,
      });
    }
  }

  /** `DELETE /posts/:postId/like` (docs/API.md §8) — idempotent either way. */
  async unlike(userId: string, postId: string): Promise<void> {
    await this.findActivePost(postId);
    await this.prisma.like.deleteMany({ where: { userId, postId } });
  }

  /**
   * `PostResponse.likesCount`/`isLikedByMe` (docs/API.md §7) — batched for a
   * whole page of posts (e.g. the feed) in one pair of queries, not N; used
   * for a single post too (an array of one) so `PostsService` never needs
   * two different calling conventions. `isLikedByMe` is `null` for an
   * anonymous viewer (never computed), `false`/`true` for an authenticated
   * one — the same convention `isFollowedByMe` established (Milestone 10).
   */
  async getLikeStateForPosts(
    postIds: string[],
    viewerId: string | undefined,
  ): Promise<Map<string, LikeState>> {
    if (postIds.length === 0) return new Map();

    const [counts, likedByViewer] = await Promise.all([
      this.prisma.like.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: true,
      }),
      viewerId
        ? this.prisma.like.findMany({
            where: { userId: viewerId, postId: { in: postIds } },
            select: { postId: true },
          })
        : Promise.resolve(null),
    ]);

    const countByPostId = new Map(
      counts.map((row) => [row.postId, row._count]),
    );
    const likedSet = likedByViewer
      ? new Set(likedByViewer.map((row) => row.postId))
      : null;

    return new Map(
      postIds.map((postId) => [
        postId,
        {
          likesCount: countByPostId.get(postId) ?? 0,
          isLikedByMe: likedSet
            ? likedSet.has(postId)
            : viewerId
              ? false
              : null,
        },
      ]),
    );
  }

  /** `GET /posts/:postId/likes` (docs/API.md §8) — reuses `FollowListResponse` verbatim; see docs/PROGRESS.md's Milestone 13 deviations for why no new type was introduced. */
  async getLikers(
    postId: string,
    viewerId: string | undefined,
    query: PaginationQuery,
  ): Promise<FollowListResponse> {
    await this.findActivePost(postId);
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.like.findMany({
      where: {
        postId,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, userId: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
      include: { user: { include: { avatarMedia: true } } },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.userId })
        : null;

    // One extra query for the whole page's isFollowedByMe, not one per row —
    // the same batching FollowsService's list endpoints already established.
    const followedIds =
      viewerId && page.length > 0
        ? new Set(
            (
              await this.prisma.follow.findMany({
                where: {
                  followerId: viewerId,
                  followingId: { in: page.map((row) => row.user.id) },
                },
                select: { followingId: true },
              })
            ).map((edge) => edge.followingId),
          )
        : null;

    const data: FollowListItem[] = page.map((row) => ({
      id: row.user.id,
      username: row.user.username,
      fullName: row.user.fullName,
      avatarUrl: this.mediaService.resolveAvatarUrl(row.user.avatarMedia),
      isFollowedByMe: followedIds ? followedIds.has(row.user.id) : null,
    }));

    return { data, meta: { nextCursor } };
  }

  private async findActivePost(
    postId: string,
  ): Promise<{ id: string; authorId: string }> {
    // Small, self-contained existence check rather than a `PostsModule`
    // dependency — the same "duplicate a tiny lookup over growing the
    // dependency graph" trade-off `FollowsService`/`UsersService` already
    // make for their own `findActiveUserByUsername` copies. `PostsModule`
    // depends on `LikesModule` (for `likesCount`/`isLikedByMe`), so the
    // reverse dependency would be circular anyway. Now also returns
    // `authorId` (Milestone 16) — the like notification's recipient.
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
