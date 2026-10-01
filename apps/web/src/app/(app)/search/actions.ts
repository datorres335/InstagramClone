'use server';

import type { FollowListResponse } from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

/**
 * `GET /search/users?q=` (docs/API.md §11, Milestone 17) — only a Server
 * Action can read the httpOnly session cookie via `getApiClient()`, the
 * same reason every other mutating/fetching client component in this
 * codebase goes through one. Short-circuits below the 2-character minimum
 * itself rather than letting the API's own validation error surface mid-
 * keystroke — normal typing passes through "a"/"al" on the way to a real
 * query, and flashing a validation error for that is worse UX than just
 * showing no results yet.
 */
export async function searchUsersAction(
  q: string,
): Promise<FollowListResponse> {
  if (q.trim().length < 2) {
    return { data: [], meta: { nextCursor: null } };
  }
  return getApiClient().search.searchUsers({ q });
}
