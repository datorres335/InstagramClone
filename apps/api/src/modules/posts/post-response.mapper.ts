import type {
  Media,
  Post,
  PostMedia,
  User,
} from '@instagram-clone/prisma-client';
import type { PostResponse } from '@instagram-clone/validation';

import {
  resolveAvatarUrl,
  resolveVariantUrls,
} from '../media/media-response.mapper';
import type { StorageService } from '../../storage/storage.service';

/**
 * The join shape `PostsService`'s `include: { author: { include: {
 * avatarMedia: true } }, media: { include: { media: true }, orderBy: {
 * position: 'asc' } } }` produces (inlined at each Prisma call site rather
 * than shared, so Prisma's own generic inference resolves the result type
 * correctly — a separately-declared `include` constant defeats that
 * inference). A plain intersection type, not a generated Prisma payload
 * type, matching `FollowsService`'s established convention for typing
 * `include` results (`apps/api/src/modules/follows/follows.service.ts`).
 */
export type PostWithRelations = Post & {
  author: User & { avatarMedia: Media | null };
  media: (PostMedia & { media: Media })[];
};

/**
 * `likesCount`/`commentsCount` are `0` and `isLikedByMe`/`isSavedByMe` follow
 * the same null-for-anonymous, real-boolean-for-authenticated convention
 * `isFollowedByMe` established (Milestone 10) — real values land with
 * `Like`/`SavedPost` (Milestones 13/15).
 */
export function toPostResponse(
  post: PostWithRelations,
  storage: StorageService,
  isViewerAuthenticated: boolean,
): PostResponse {
  return {
    id: post.id,
    author: {
      id: post.author.id,
      username: post.author.username,
      fullName: post.author.fullName,
      avatarUrl: resolveAvatarUrl(post.author.avatarMedia, storage),
    },
    caption: post.caption,
    location: post.location,
    media: post.media.map((postMedia) => {
      const variants = resolveVariantUrls(postMedia.media, storage);
      return {
        id: postMedia.media.id,
        // `variants` is guaranteed non-null here: only READY media can ever
        // be attached (MediaService.getReadyMediaForAttachment), and nothing
        // in this MVP un-READYs a media row afterward.
        url: variants?.feed ?? '',
        thumbnailUrl: variants?.thumbnail ?? '',
        width: postMedia.media.width,
        height: postMedia.media.height,
        blurhash: postMedia.media.blurhash,
        altText: postMedia.altText,
        position: postMedia.position,
      };
    }),
    likesCount: 0,
    commentsCount: 0,
    isLikedByMe: isViewerAuthenticated ? false : null,
    isSavedByMe: isViewerAuthenticated ? false : null,
    createdAt: post.createdAt.toISOString(),
  };
}
