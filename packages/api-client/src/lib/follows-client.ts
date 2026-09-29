import type {
  FollowListResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface FollowsClient {
  /** `PUT /users/:username/follow` (docs/API.md §5) — idempotent. */
  follow(username: string): Promise<void>;
  /** `DELETE /users/:username/follow` (docs/API.md §5) — idempotent either way. */
  unfollow(username: string): Promise<void>;
  getFollowers(
    username: string,
    query?: PaginationQuery,
  ): Promise<FollowListResponse>;
  getFollowing(
    username: string,
    query?: PaginationQuery,
  ): Promise<FollowListResponse>;
}

export function createFollowsClient(http: HttpClient): FollowsClient {
  return {
    follow(username) {
      return http.authorizedRequest<void>(
        'PUT',
        `/users/${encodeURIComponent(username)}/follow`,
      );
    },

    unfollow(username) {
      return http.authorizedRequest<void>(
        'DELETE',
        `/users/${encodeURIComponent(username)}/follow`,
      );
    },

    getFollowers(username, query) {
      return http.optionallyAuthorizedRequest<FollowListResponse>(
        'GET',
        `/users/${encodeURIComponent(username)}/followers${buildQueryString(query)}`,
      );
    },

    getFollowing(username, query) {
      return http.optionallyAuthorizedRequest<FollowListResponse>(
        'GET',
        `/users/${encodeURIComponent(username)}/following${buildQueryString(query)}`,
      );
    },
  };
}
