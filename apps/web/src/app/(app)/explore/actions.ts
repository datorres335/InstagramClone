'use server';

import type { ExploreResponse } from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

/**
 * The "load more" Server Action behind `ExploreGrid` (Milestone 18) —
 * mirrors `home/actions.ts`'s `getFeedPageAction`; only a Server Action can
 * read the httpOnly session cookie via `getApiClient()`.
 */
export async function getExplorePageAction(
  cursor: string | undefined,
): Promise<ExploreResponse> {
  return getApiClient().posts.getExplore({ cursor });
}
