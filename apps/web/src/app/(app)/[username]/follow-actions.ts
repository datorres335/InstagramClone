'use server';

import { getApiClient } from '../../../lib/get-api-client';

/** Thin Server Action wrappers — only a Server Action can read the session cookie (`getApiClient`). */
export async function followAction(username: string): Promise<void> {
  await getApiClient().follows.follow(username);
}

export async function unfollowAction(username: string): Promise<void> {
  await getApiClient().follows.unfollow(username);
}
