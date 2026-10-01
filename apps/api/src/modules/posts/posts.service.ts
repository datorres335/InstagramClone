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
  SavedPostsResponse,
  UserPostsResponse,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentsService } from '../comments/comments.service';
import { LikesService } from '../likes/likes.service';
import { MediaService } from '../media/media.service';
import { resolveVariantUrls } from '../media/media-response.mapper';
import { SavedPostsService } from '../saved-posts/saved-posts.service';
import { StorageService } from '../../storage/storage.service';
import { toPostResponse } from './post-response.mapper';
import type { PostWithRelations } from './post-response.mapper';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
    private readonly savedPostsService: SavedPostsService,
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

    // A freshly created post always has 0 likes/comments, isn't liked, and
    // isn't saved by its own creator yet — no need to query
    // LikesService/CommentsService/SavedPostsService for a post that didn't
    // exist a moment ago.
    return toPostResponse(
      post,
      this.storage,
      { likesCount: 0, isLikedByMe: false },
      0,
      false,
    );
  }

  /** `GET /posts/:id` (docs/API.md §7) — optional auth, only changes `isLikedByMe`/`isSavedByMe`. */
  async getById(
    postId: string,
    viewerId: string | undefined,
  ): Promise<PostResponse> {
    const post = await this.findActivePost(postId);
    const [likeState, commentCounts, savedState] = await Promise.all([
      this.likesService.getLikeStateForPosts([postId], viewerId),
      this.commentsService.getCommentCountForPosts([postId]),
      this.savedPostsService.getSavedStateForPosts([postId], viewerId),
    ]);
    return toPostResponse(
      post,
      this.storage,
      likeState.get(postId) ?? { likesCount: 0, isLikedByMe: null },
      commentCounts.get(postId) ?? 0,
      savedState.get(postId) ?? null,
    );
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

    // Batched for the whole page — one pair of queries each, not one per post.
    const postIds = page.map((post) => post.id);
    const [likeStates, commentCounts, savedStates] = await Promise.all([
      this.likesService.getLikeStateForPosts(postIds, viewerId),
      this.commentsService.getCommentCountForPosts(postIds),
      this.savedPostsService.getSavedStateForPosts(postIds, viewerId),
    ]);
    const data: PostResponse[] = page.map((post) =>
      toPostResponse(
        post,
        this.storage,
        likeStates.get(post.id) ?? { likesCount: 0, isLikedByMe: false },
        commentCounts.get(post.id) ?? 0,
        savedStates.get(post.id) ?? false,
      ),
    );

    return { data, meta: { nextCursor } };
  }

  /**
   * `GET /me/saved` (docs/API.md §10) — the caller's own saved posts, newest
   * first, as full `PostResponse` items (the same choice `GET /feed` made).
   * `SavedPostsService` only knows the paginated `postId` list; this method
   * does the actual Post lookup + `LikesService`/`CommentsService` batching +
   * `toPostResponse` mapping, the same pipeline `getFeed` uses — living here
   * rather than in `SavedPostsService` avoids a circular `PostsModule`
   * dependency (`PostsModule` already depends on `SavedPostsModule` for
   * `isSavedByMe`).
   */
  async getSavedPosts(
    viewerId: string,
    query: PaginationQuery,
  ): Promise<SavedPostsResponse> {
    const { postIds, nextCursor } =
      await this.savedPostsService.getSavedPostIdsForViewer(viewerId, query);
    if (postIds.length === 0) {
      return { data: [], meta: { nextCursor } };
    }

    const rows = await this.prisma.post.findMany({
      where: { id: { in: postIds }, deletedAt: null },
      include: {
        author: { include: { avatarMedia: true } },
        media: { include: { media: true }, orderBy: { position: 'asc' } },
      },
    });

    // `findMany({ where: { id: { in } } })` doesn't preserve the input
    // order — re-sort to match the saved-newest-first order the id list
    // was already fetched in.
    const postById = new Map(rows.map((row) => [row.id, row]));
    const orderedPosts = postIds
      .map((id) => postById.get(id))
      .filter((row): row is PostWithRelations => row !== undefined);

    const [likeStates, commentCounts] = await Promise.all([
      this.likesService.getLikeStateForPosts(
        orderedPosts.map((post) => post.id),
        viewerId,
      ),
      this.commentsService.getCommentCountForPosts(
        orderedPosts.map((post) => post.id),
      ),
    ]);

    const data: PostResponse[] = orderedPosts.map((post) =>
      toPostResponse(
        post,
        this.storage,
        likeStates.get(post.id) ?? { likesCount: 0, isLikedByMe: false },
        commentCounts.get(post.id) ?? 0,
        // Every item in this list is, by definition, saved by the viewer —
        // no need to query SavedPostsService.getSavedStateForPosts again.
        true,
      ),
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
