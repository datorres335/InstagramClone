'use client';

import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { useState } from 'react';

import type { MediaResponse } from '@instagram-clone/validation';

import { UserAvatar } from '../../../../components/ui/user-avatar';
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
  username: string;
  currentAvatarUrl: string | null;
}

/**
 * Presign → direct browser `PUT` to the bucket → complete → poll → set as
 * avatar (docs/ARCHITECTURE.md §8, docs/FEATURES.md #4). No client-side crop
 * widget on web — the server's `sharp` center-crop (`fit: 'cover'`,
 * `MediaProcessor`) handles squaring the thumbnail, an explicit scoping
 * decision recorded in docs/PROGRESS.md.
 */
export function AvatarUploader({
  username,
  currentAvatarUrl,
}: AvatarUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'processing' | 'done'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const busy = status === 'uploading' || status === 'processing';

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
    <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
      <UserAvatar
        username={username}
        avatarUrl={previewUrl}
        size="md"
        alt="Your avatar"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold">@{username}</span>
        {busy && (
          <LinearProgress
            aria-label={status === 'uploading' ? 'Uploading' : 'Processing'}
          />
        )}
        {status === 'uploading' && (
          <p className="text-caption text-text-secondary">Uploading…</p>
        )}
        {status === 'processing' && (
          <p className="text-caption text-text-secondary">Processing…</p>
        )}
        {status === 'done' && (
          <p className="text-caption text-success">Photo updated.</p>
        )}
        {error && (
          <p role="alert" className="text-caption text-error">
            {error}
          </p>
        )}
      </div>
      {/* The label is the button, so `getByLabel('Change photo')` and screen
          readers both reach the file input through it. */}
      <Button
        component="label"
        variant="contained"
        size="small"
        disabled={busy}
      >
        Change photo
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={busy}
          className="sr-only"
        />
      </Button>
    </div>
  );
}
