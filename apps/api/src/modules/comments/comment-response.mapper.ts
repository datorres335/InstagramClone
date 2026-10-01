import type { Comment, Media, User } from '@instagram-clone/prisma-client';
import type { CommentResponse } from '@instagram-clone/validation';

import { resolveAvatarUrl } from '../media/media-response.mapper';
import type { StorageService } from '../../storage/storage.service';

/**
 * The join shape `CommentsService`'s `include: { author: { include: {
 * avatarMedia: true } } }` produces — inlined at each Prisma call site
 * rather than shared (a separately-declared `include` constant defeats
 * Prisma's own generic inference — the Milestone 11 lesson,
 * `apps/api/src/modules/posts/post-response.mapper.ts`).
 */
export type CommentWithAuthor = Comment & {
  author: User & { avatarMedia: Media | null };
};

export function toCommentResponse(
  comment: CommentWithAuthor,
  storage: StorageService,
): CommentResponse {
  return {
    id: comment.id,
    author: {
      id: comment.author.id,
      username: comment.author.username,
      fullName: comment.author.fullName,
      avatarUrl: resolveAvatarUrl(comment.author.avatarMedia, storage),
    },
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}
