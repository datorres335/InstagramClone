import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Media, User } from '@instagram-clone/prisma-client';
import type {
  FollowListItem,
  FollowListResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

type UserWithAvatar = User & { avatarMedia: Media | null };

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * `PUT /users/:username/follow` (docs/API.md §5) — idempotent, `409` on
   * self-follow (so there's no self-notification risk to separately guard
   * against here). The notification is only enqueued on a genuine new
   * follow (checked before the upsert via `isFollowing`), not on every
   * repeat idempotent call — the same "no spam on repeat" discipline
   * `LikesService.like` applies.
   */
  async follow(followerId: string, username: string): Promise<void> {
    const target = await this.findActiveUserByUsername(username);
    if (target.id === followerId) {
      throw new ConflictException('You cannot follow yourself.');
    }
    const alreadyFollowing = await this.isFollowing(followerId, target.id);

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId: target.id },
      },
      create: { followerId, followingId: target.id },
      update: {},
    });

    if (!alreadyFollowing) {
      await this.notificationsService.enqueueNotification({
        recipientId: target.id,
        actorId: followerId,
        type: 'FOLLOW',
      });
    }
  }

  /** `DELETE /users/:username/follow` (docs/API.md §5) — idempotent either way. */
  async unfollow(followerId: string, username: string): Promise<void> {
    const target = await this.findActiveUserByUsername(username);
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: target.id },
    });
  }

  async getFollowCounts(
    userId: string,
  ): Promise<{ followers: number; following: number }> {
    const [followers, following] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return { followers, following };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const edge = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { followerId: true },
    });
    return edge !== null;
  }

  /** Who follows `username` — newest edge first, keyset-paginated by `(createdAt, followerId)`. */
  async getFollowers(
    username: string,
    viewerId: string | undefined,
    query: PaginationQuery,
  ): Promise<FollowListResponse> {
    const target = await this.findActiveUserByUsername(username);
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: target.id,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, followerId: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: query.limit + 1,
      include: { follower: { include: { avatarMedia: true } } },
    });

    return this.toListResponse(
      rows.map((row) => ({
        user: row.follower,
        createdAt: row.createdAt,
        cursorId: row.followerId,
      })),
      query.limit,
      viewerId,
    );
  }

  /** Who `username` follows — newest edge first, keyset-paginated by `(createdAt, followingId)`. */
  async getFollowing(
    username: string,
    viewerId: string | undefined,
    query: PaginationQuery,
  ): Promise<FollowListResponse> {
    const target = await this.findActiveUserByUsername(username);
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: target.id,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, followingId: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
      take: query.limit + 1,
      include: { following: { include: { avatarMedia: true } } },
    });

    return this.toListResponse(
      rows.map((row) => ({
        user: row.following,
        createdAt: row.createdAt,
        cursorId: row.followingId,
      })),
      query.limit,
      viewerId,
    );
  }

  private async toListResponse(
    rows: { user: UserWithAvatar; createdAt: Date; cursorId: string }[],
    limit: number,
    viewerId: string | undefined,
  ): Promise<FollowListResponse> {
    const page = rows.slice(0, limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.cursorId })
        : null;

    // One extra query for the whole page's isFollowedByMe, not one per row.
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

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }

  private async findActiveUserByUsername(username: string): Promise<User> {
    // Same shape as `UsersService`'s private helper of the same name — kept
    // as its own small copy rather than a shared abstraction, consistent
    // with this codebase's tolerance for duplicating a handful of lines over
    // introducing a cross-module dependency for it (see `MediaService`'s
    // `getOwnedMedia` for the same trade-off).
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }
}
