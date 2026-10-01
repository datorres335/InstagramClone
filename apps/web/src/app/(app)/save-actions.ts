'use server';

import { getApiClient } from '../../lib/get-api-client';

export async function saveAction(postId: string): Promise<void> {
  await getApiClient().savedPosts.save(postId);
}

export async function unsaveAction(postId: string): Promise<void> {
  await getApiClient().savedPosts.unsave(postId);
}
