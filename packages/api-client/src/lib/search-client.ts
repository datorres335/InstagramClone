import type { FollowListResponse } from '@instagram-clone/validation';

import type { HttpClient } from './http-client';

export interface SearchUsersParams {
  q: string;
  limit?: number;
}

export interface SearchClient {
  /**
   * `GET /search/users?q=` (docs/API.md §11, Milestone 17) — ranked by
   * `pg_trgm` similarity, optional auth. No `cursor` (unlike every other
   * list client method) — see `packages/validation/src/lib/search.ts`'s
   * doc comment for why this endpoint has no keyset pagination at all.
   * `limit` is optional here (unlike `SearchUsersQuery`, where Zod's
   * `.default(20)` makes it always-present post-parse) so callers can omit
   * it and let the server's own default apply, the same convention
   * `Partial<PaginationQuery>` establishes for every other list method.
   */
  searchUsers(params: SearchUsersParams): Promise<FollowListResponse>;
}

export function createSearchClient(http: HttpClient): SearchClient {
  return {
    searchUsers({ q, limit }) {
      const params = new URLSearchParams({ q });
      if (limit !== undefined) {
        params.set('limit', String(limit));
      }
      return http.optionallyAuthorizedRequest<FollowListResponse>(
        'GET',
        `/search/users?${params.toString()}`,
      );
    },
  };
}
