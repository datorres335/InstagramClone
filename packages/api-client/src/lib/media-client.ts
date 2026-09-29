import type {
  MediaResponse,
  PresignMediaInput,
  PresignMediaResponse,
} from '@instagram-clone/validation';

import type { HttpClient } from './http-client';

export interface MediaClient {
  presign(input: PresignMediaInput): Promise<PresignMediaResponse>;
  complete(mediaId: string): Promise<MediaResponse>;
  getById(mediaId: string): Promise<MediaResponse>;
  /**
   * `PUT`s the raw file bytes straight to the presigned `uploadUrl`
   * (docs/ARCHITECTURE.md §8 point 2) — a direct browser/device-to-bucket
   * request, not routed through the API's `HttpClient` (no auth header, no
   * `baseUrl` prefix, no JSON body).
   */
  uploadToPresignedUrl(
    uploadUrl: string,
    file: Blob,
    contentType: string,
  ): Promise<void>;
  /**
   * Polls `GET /media/:id` until processing finishes (`READY`/`FAILED`) or
   * `timeoutMs` elapses — the same wait loop `apps/web`/`apps/mobile` both
   * need after a `complete` call, so it lives here once rather than twice.
   */
  waitUntilProcessed(
    mediaId: string,
    options?: { intervalMs?: number; timeoutMs?: number },
  ): Promise<MediaResponse>;
}

const DEFAULT_POLL_INTERVAL_MS = 750;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMediaClient(http: HttpClient): MediaClient {
  return {
    presign(input) {
      return http.authorizedRequest<PresignMediaResponse, PresignMediaInput>(
        'POST',
        '/media/presign',
        input,
      );
    },

    complete(mediaId) {
      return http.authorizedRequest<MediaResponse>(
        'POST',
        `/media/${encodeURIComponent(mediaId)}/complete`,
      );
    },

    getById(mediaId) {
      return http.authorizedRequest<MediaResponse>(
        'GET',
        `/media/${encodeURIComponent(mediaId)}`,
      );
    },

    async uploadToPresignedUrl(uploadUrl, file, contentType) {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!res.ok) {
        throw new Error(`Direct upload failed with status ${res.status}.`);
      }
    },

    async waitUntilProcessed(mediaId, options) {
      const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const timeoutMs = options?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
      const deadline = Date.now() + timeoutMs;

      for (;;) {
        const media = await http.authorizedRequest<MediaResponse>(
          'GET',
          `/media/${encodeURIComponent(mediaId)}`,
        );
        if (media.status !== 'PENDING') return media;
        if (Date.now() >= deadline) {
          throw new Error('Timed out waiting for media processing to finish.');
        }
        await sleep(intervalMs);
      }
    },
  };
}
