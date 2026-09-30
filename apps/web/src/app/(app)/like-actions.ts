'use server';

import { getApiClient } from '../../lib/get-api-client';

export async function likeAction(postId: string): Promise<void> {
  await getApiClient().likes.like(postId);
}

export async function unlikeAction(postId: string): Promise<void> {
  await getApiClient().likes.unlike(postId);
}
