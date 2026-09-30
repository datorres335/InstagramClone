import type {
  FollowListResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface LikesClient {
  /** `PUT /posts/:postId/like` (docs/API.md §8) — idempotent. */
  like(postId: string): Promise<void>;
  /** `DELETE /posts/:postId/like` (docs/API.md §8) — idempotent either way. */
  unlike(postId: string): Promise<void>;
  /** `GET /posts/:postId/likes` (docs/API.md §8) — reuses `FollowListResponse` verbatim; the shapes are identical. */
  getLikers(
    postId: string,
    query?: Partial<PaginationQuery>,
  ): Promise<FollowListResponse>;
}

export function createLikesClient(http: HttpClient): LikesClient {
  return {
    like(postId) {
      return http.authorizedRequest<void>(
        'PUT',
        `/posts/${encodeURIComponent(postId)}/like`,
      );
    },

    unlike(postId) {
      return http.authorizedRequest<void>(
        'DELETE',
        `/posts/${encodeURIComponent(postId)}/like`,
      );
    },

    getLikers(postId, query) {
      return http.optionallyAuthorizedRequest<FollowListResponse>(
        'GET',
        `/posts/${encodeURIComponent(postId)}/likes${buildQueryString(query)}`,
      );
    },
  };
}
