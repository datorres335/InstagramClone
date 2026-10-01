import type {
  PaginationQuery,
  SavedPostsResponse,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface SavedPostsClient {
  /** `PUT /posts/:postId/save` (docs/API.md §10) — idempotent. */
  save(postId: string): Promise<void>;
  /** `DELETE /posts/:postId/save` (docs/API.md §10) — idempotent either way. */
  unsave(postId: string): Promise<void>;
  /**
   * `GET /me/saved` (docs/API.md §10, Milestone 15) — the caller's own saved
   * posts, newest first. `Partial`, not `PaginationQuery`, matching
   * `PostsClient.getFeed`'s reasoning: a "load more" affordance only ever
   * has a `cursor` in hand.
   */
  getSaved(query?: Partial<PaginationQuery>): Promise<SavedPostsResponse>;
}

export function createSavedPostsClient(http: HttpClient): SavedPostsClient {
  return {
    save(postId) {
      return http.authorizedRequest<void>(
        'PUT',
        `/posts/${encodeURIComponent(postId)}/save`,
      );
    },

    unsave(postId) {
      return http.authorizedRequest<void>(
        'DELETE',
        `/posts/${encodeURIComponent(postId)}/save`,
      );
    },

    getSaved(query) {
      return http.authorizedRequest<SavedPostsResponse>(
        'GET',
        `/me/saved${buildQueryString(query)}`,
      );
    },
  };
}
