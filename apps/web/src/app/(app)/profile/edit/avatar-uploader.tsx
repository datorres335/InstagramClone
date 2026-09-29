'use client';

import { useState } from 'react';

import type { MediaResponse } from '@instagram-clone/validation';

import {
  completeAvatarUpload,
  getAvatarMediaStatus,
  presignAvatarUpload,
  setAvatarAction,
} from './avatar-actions';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilProcessed(mediaId: string): Promise<MediaResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const media = await getAvatarMediaStatus(mediaId);
    if (media.status !== 'PENDING') return media;
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the photo to finish processing.');
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
}

/**
 * Presign → direct browser `PUT` to the bucket → complete → poll → set as
 * avatar (docs/ARCHITECTURE.md §8, docs/FEATURES.md #4). No client-side crop
 * widget on web — the server's `sharp` center-crop (`fit: 'cover'`,
 * `MediaProcessor`) handles squaring the thumbnail, an explicit scoping
 * decision recorded in docs/PROGRESS.md.
 */
export function AvatarUploader({ currentAvatarUrl }: AvatarUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'processing' | 'done'
  >('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }

    setError(null);
    setStatus('uploading');
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const { mediaId, uploadUrl } = await presignAvatarUpload({
        contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        byteSize: file.size,
      });

      // Direct upload to the bucket (docs/ARCHITECTURE.md §8 point 2) — the
      // API/Next server never sees the file body.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed with status ${putRes.status}.`);
      }

      await completeAvatarUpload(mediaId);

      setStatus('processing');
      const processed = await waitUntilProcessed(mediaId);
      if (processed.status === 'FAILED') {
        throw new Error(processed.failureReason ?? 'Photo processing failed.');
      }

      await setAvatarAction(mediaId);
      setStatus('done');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Something went wrong uploading your photo. Please try again.',
      );
      setPreviewUrl(currentAvatarUrl);
      setStatus('idle');
    } finally {
      URL.revokeObjectURL(localPreview);
    }
  }

  return (
    <div>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a transient
        // local object URL preview during upload; Next's Image loader
        // doesn't handle blob: URLs.
        <img
          src={previewUrl}
          alt="Your avatar"
          width={96}
          height={96}
          style={{ borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            backgroundColor: '#e5e7eb',
          }}
        />
      )}
      <div>
        <label htmlFor="avatar">Change photo</label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={status === 'uploading' || status === 'processing'}
        />
      </div>
      {status === 'uploading' && <p>Uploading…</p>}
      {status === 'processing' && <p>Processing…</p>}
      {status === 'done' && <p>Photo updated.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
