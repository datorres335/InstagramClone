'use server';

import { redirect } from 'next/navigation';

import type { FeedResponse } from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

export async function logoutAction(): Promise<void> {
  await getApiClient().auth.logout();
  redirect('/login');
}

/**
 * The "load more" Server Action behind `FeedList` (Milestone 12) — only a
 * Server Action can read the httpOnly session cookie via `getApiClient()`,
 * the same reason `posts/new/post-actions.ts` wraps the upload pipeline
 * calls instead of the client component calling `apiClient` directly.
 */
export async function getFeedPageAction(
  cursor: string | undefined,
): Promise<FeedResponse> {
  return getApiClient().posts.getFeed({ cursor });
}
