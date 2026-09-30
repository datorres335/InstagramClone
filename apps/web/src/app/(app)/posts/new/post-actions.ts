'use server';

import { redirect } from 'next/navigation';

import type {
  CreatePostInput,
  MediaResponse,
  PresignMediaInput,
} from '@instagram-clone/validation';

import { getApiClient } from '../../../../lib/get-api-client';

/**
 * Thin Server Action wrappers (only a Server Action can read the session
 * cookie via `getApiClient()`) — mirrors `apps/web/.../profile/edit/
 * avatar-actions.ts`'s pattern, reused here for post images
 * (`purpose: 'POST_IMAGE'` instead of `'AVATAR'`).
 */
export async function presignPostImage(
  input: Omit<PresignMediaInput, 'purpose'>,
): Promise<{ mediaId: string; uploadUrl: string }> {
  return getApiClient().media.presign({ ...input, purpose: 'POST_IMAGE' });
}

export async function completePostImage(
  mediaId: string,
): Promise<MediaResponse> {
  return getApiClient().media.complete(mediaId);
}

export async function getPostImageStatus(
  mediaId: string,
): Promise<MediaResponse> {
  return getApiClient().media.getById(mediaId);
}

export async function createPostAction(input: CreatePostInput): Promise<never> {
  const post = await getApiClient().posts.create(input);
  redirect(`/p/${post.id}`);
}
