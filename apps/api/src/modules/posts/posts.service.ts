import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreatePostInput,
  FeedResponse,
  PaginationQuery,
  PostResponse,
  PostSummary,
  UserPostsResponse,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { resolveVariantUrls } from '../media/media-response.mapper';
import { StorageService } from '../../storage/storage.service';
import { toPostResponse } from './post-response.mapper';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
  ) {}

  /** `POST /posts` (docs/API.md §7) — 1–10 images, all the caller's own `READY` `POST_IMAGE` media, none already attached elsewhere. */
  async createPost(
    authorId: string,
    input: CreatePostInput,
  ): Promise<PostResponse> {
    if (new Set(input.mediaIds).size !== input.mediaIds.length) {
      throw new ConflictException(
        'The same media cannot be attached twice to one post.',
      );
    }

    // Sequential, not batched — `apps/api/src/modules/media/media.service.ts`
    // doesn't expose a multi-id lookup, and this is capped at 10 items
    // (MVP scale); see docs/PROGRESS.md's Milestone 11 deviations for why
    // this was chosen over adding a batched-validation code path.
    for (const mediaId of input.mediaIds) {
      await this.mediaService.getReadyMediaForAttachment(
        authorId,
        mediaId,
        'POST_IMAGE',
      );
    }

    const alreadyAttached = await this.prisma.postMedia.findFirst({
      where: { mediaId: { in: input.mediaIds } },
    });
    if (alreadyAttached) {
      throw new ConflictException(
        'One or more of these media items is already attached to another post.',
      );
    }

    const post = await this.prisma.post.create({
      data: {
        authorId,
        caption: input.caption ?? null,
        location: input.location ?? null,
        media: {
          create: input.mediaIds.map((mediaId, position) => ({
            mediaId,
            position,
          })),
        },
      },
      include: {
        author: { include: { avatarMedia: true } },
        media: { include: { media: true }, orderBy: { position: 'asc' } },
      },
    });

    return toPostResponse(post, this.storage, true);
  }

  /** `GET /posts/:id` (docs/API.md §7) — optional auth, only changes `isLikedByMe`/`isSavedByMe`. */
  async getById(
    postId: string,
    viewerId: string | undefined,
  ): Promise<PostResponse> {
    const post = await this.findActivePost(postId);
    return toPostResponse(post, this.storage, viewerId !== undefined);
  }

  /** `DELETE /posts/:id` (docs/API.md §7) — author-only soft delete. */
  async deletePost(postId: string, userId: string): Promise<void> {
    const post = await this.findActivePost(postId);
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts.');
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  /** `GET /users/:username` (docs/API.md §4) — `PublicProfileResponse.postsCount`. */
  async getPostCountByAuthor(authorId: string): Promise<number> {
    return this.prisma.post.count({ where: { authorId, deletedAt: null } });
  }

  /** `GET /users/:username/posts` (docs/API.md §4) — the profile grid, newest first. */
  async getPostsByAuthor(
    authorId: string,
    query: PaginationQuery,
  ): Promise<UserPostsResponse> {
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.post.findMany({
      where: {
        authorId,
        deletedAt: null,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        media: {
          where: { position: 0 },
          include: { media: true },
        },
      },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    const data: PostSummary[] = page.map((post) => {
      const cover = post.media[0];
      const variants = cover
        ? resolveVariantUrls(cover.media, this.storage)
        : null;
      return {
        id: post.id,
        thumbnailUrl: variants?.thumbnail ?? null,
        createdAt: post.createdAt.toISOString(),
      };
    });

    return { data, meta: { nextCursor } };
  }

  /**
   * `GET /feed` (docs/API.md §7, docs/DATABASE.md §6) — fan-out-on-read:
   * posts from accounts the caller follows, newest first. Deliberately never
   * includes the caller's own posts (docs/FEATURES.md #10's explicit
   * default, matching Instagram) — "who I follow" and "myself" are disjoint
   * by construction, since `Follow` rows never target the follower's own id.
   */
  async getFeed(
    viewerId: string,
    query: PaginationQuery,
  ): Promise<FeedResponse> {
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    if (following.length === 0) {
      return { data: [], meta: { nextCursor: null } };
    }
    const followingIds = following.map((edge) => edge.followingId);

    const rows = await this.prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        deletedAt: null,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        author: { include: { avatarMedia: true } },
        media: { include: { media: true }, orderBy: { position: 'asc' } },
      },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    const data: PostResponse[] = page.map((post) =>
      toPostResponse(post, this.storage, true),
    );

    return { data, meta: { nextCursor } };
  }

  private async findActivePost(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: {
        author: { include: { avatarMedia: true } },
        media: { include: { media: true }, orderBy: { position: 'asc' } },
      },
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
