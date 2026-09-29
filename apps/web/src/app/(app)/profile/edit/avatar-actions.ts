'use server';

import type {
  MediaResponse,
  PresignMediaInput,
  PresignMediaResponse,
} from '@instagram-clone/validation';

import { getApiClient } from '../../../../lib/get-api-client';

/**
 * Thin Server Action wrappers around `apiClient.media.*`/`updateAvatar`
 * (docs/ARCHITECTURE.md §8). Needed because `getApiClient()` reads the
 * session cookie via `next/headers`, which only works in a Server
 * Action/Component — the actual file bytes and the direct-to-bucket `PUT`
 * happen client-side in `avatar-uploader.tsx`, which calls these for
 * everything that needs the authenticated API.
 */
export async function presignAvatarUpload(
  input: Omit<PresignMediaInput, 'purpose'>,
): Promise<PresignMediaResponse> {
  return getApiClient().media.presign({ ...input, purpose: 'AVATAR' });
}

export async function completeAvatarUpload(
  mediaId: string,
): Promise<MediaResponse> {
  return getApiClient().media.complete(mediaId);
}

export async function getAvatarMediaStatus(
  mediaId: string,
): Promise<MediaResponse> {
  return getApiClient().media.getById(mediaId);
}

export async function setAvatarAction(mediaId: string): Promise<MediaResponse> {
  return getApiClient().users.updateAvatar(mediaId);
}
