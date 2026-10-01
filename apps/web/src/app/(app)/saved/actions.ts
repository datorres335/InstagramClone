'use server';

import type { SavedPostsResponse } from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

/**
 * The "load more" Server Action behind `SavedPostsList` (Milestone 15) —
 * mirrors `home/actions.ts`'s `getFeedPageAction`; only a Server Action can
 * read the httpOnly session cookie via `getApiClient()`.
 */
export async function getSavedPageAction(
  cursor: string | undefined,
): Promise<SavedPostsResponse> {
  return getApiClient().savedPosts.getSaved({ cursor });
}
