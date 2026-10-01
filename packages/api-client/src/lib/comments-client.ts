import type {
  CommentListResponse,
  CommentResponse,
  CreateCommentInput,
  PaginationQuery,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface CommentsClient {
  /** `POST /posts/:postId/comments` (docs/API.md §9). */
  create(postId: string, input: CreateCommentInput): Promise<CommentResponse>;
  /** `GET /posts/:postId/comments` (docs/API.md §9) — paginated, oldest-first. */
  list(
    postId: string,
    query?: Partial<PaginationQuery>,
  ): Promise<CommentListResponse>;
  /** `DELETE /posts/:postId/comments/:commentId` (docs/API.md §9) — the comment author or the post author. */
  remove(postId: string, commentId: string): Promise<void>;
}

export function createCommentsClient(http: HttpClient): CommentsClient {
  return {
    create(postId, input) {
      return http.authorizedRequest<CommentResponse, CreateCommentInput>(
        'POST',
        `/posts/${encodeURIComponent(postId)}/comments`,
        input,
      );
    },

    list(postId, query) {
      return http.optionallyAuthorizedRequest<CommentListResponse>(
        'GET',
        `/posts/${encodeURIComponent(postId)}/comments${buildQueryString(query)}`,
      );
    },

    remove(postId, commentId) {
      return http.authorizedRequest<void>(
        'DELETE',
        `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      );
    },
  };
}
