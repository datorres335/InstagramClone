'use server';

import { redirect } from 'next/navigation';

import { getApiClient } from '../../lib/get-api-client';

export async function deletePostAction(
  postId: string,
  authorUsername: string,
): Promise<never> {
  await getApiClient().posts.remove(postId);
  redirect(`/${authorUsername}`);
}
