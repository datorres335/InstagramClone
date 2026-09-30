'use client';

import { useState } from 'react';

import type { MediaResponse } from '@instagram-clone/validation';

import {
  completePostImage,
  createPostAction,
  getPostImageStatus,
  presignPostImage,
} from './post-actions';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_IMAGES = 10;
const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilProcessed(mediaId: string): Promise<MediaResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const media = await getPostImageStatus(mediaId);
    if (media.status !== 'PENDING') return media;
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for a photo to finish processing.');
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

interface ImageSlot {
  file: File;
  previewUrl: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  mediaId: string | null;
  error: string | null;
}

/**
 * Multi-image presign → direct-upload → poll flow (docs/ARCHITECTURE.md §8,
 * reused as-is from Milestone 9's avatar upload — the pipeline is identical
 * per image, just run once per selected file, sequentially, so upload order
 * matches carousel `position` deterministically). No client-side crop — post
 * images keep their original aspect ratio (`MediaProcessor`'s `feed`
 * variant), unlike the avatar `thumbnail` variant.
 */
export function CreatePostForm() {
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`You can add at most ${MAX_IMAGES} images.`);
      return;
    }
    const invalid = files.find((file) => !ALLOWED_CONTENT_TYPES.has(file.type));
    if (invalid) {
      setError('Please choose only JPEG, PNG, or WebP images.');
      return;
    }

    setError(null);
    const newSlots: ImageSlot[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      mediaId: null,
      error: null,
    }));
    setImages((prev) => [...prev, ...newSlots]);

    // Sequential, not parallel — keeps upload order (and therefore carousel
    // `position`) deterministic, and avoids bursting many concurrent
    // presign/PUT/complete round trips for a single post.
    for (const slot of newSlots) {
      await uploadOne(slot);
    }
  }

  async function uploadOne(slot: ImageSlot) {
    // Keyed on `previewUrl` (stable for this slot's whole lifetime, and
    // already the list's React `key`), not object identity — each call below
    // replaces the slot's object in state, so comparing by reference would
    // only ever match the *first* update; every subsequent one would
    // silently no-op against the now-stale closure.
    const previewUrl = slot.previewUrl;
    const updateSlot = (patch: Partial<ImageSlot>) => {
      setImages((prev) =>
        prev.map((s) => (s.previewUrl === previewUrl ? { ...s, ...patch } : s)),
      );
    };

    try {
      const contentType = slot.file.type as
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp';
      const { mediaId, uploadUrl } = await presignPostImage({
        contentType,
        byteSize: slot.file.size,
      });

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: slot.file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed with status ${putRes.status}.`);
      }

      await completePostImage(mediaId);
      updateSlot({ status: 'processing', mediaId });

      const processed = await waitUntilProcessed(mediaId);
      if (processed.status === 'FAILED') {
        throw new Error(processed.failureReason ?? 'Photo processing failed.');
      }
      updateSlot({ status: 'ready' });
    } catch (caught) {
      updateSlot({
        status: 'error',
        error:
          caught instanceof Error
            ? caught.message
            : 'Something went wrong uploading this photo.',
      });
    }
  }

  function removeImage(slot: ImageSlot) {
    URL.revokeObjectURL(slot.previewUrl);
    setImages((prev) => prev.filter((s) => s !== slot));
  }

  const readyMediaIds = images
    .filter((slot) => slot.status === 'ready' && slot.mediaId)
    .map((slot) => slot.mediaId as string);
  const canSubmit =
    images.length > 0 &&
    images.every((slot) => slot.status === 'ready') &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createPostAction({
        caption: caption.trim() || null,
        location: location.trim() || null,
        mediaIds: readyMediaIds,
      });
    } catch (caught) {
      // `redirect()` inside the action throws a special Next.js error on
      // success — anything else here is a genuine failure.
      if (
        caught &&
        typeof caught === 'object' &&
        'digest' in caught &&
        typeof caught.digest === 'string' &&
        caught.digest.startsWith('NEXT_REDIRECT')
      ) {
        throw caught;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : 'Something went wrong creating your post. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="images">Photos</label>
        <input
          id="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesSelected}
          disabled={images.length >= MAX_IMAGES}
        />
      </div>
      <ul>
        {images.map((slot, index) => (
          <li key={slot.previewUrl}>
            <img
              src={slot.previewUrl}
              alt={`Selected photo ${index + 1}`}
              width={96}
              height={96}
              style={{ objectFit: 'cover' }}
            />
            {slot.status === 'uploading' && <span> Uploading…</span>}
            {slot.status === 'processing' && <span> Processing…</span>}
            {slot.status === 'ready' && <span> Ready</span>}
            {slot.status === 'error' && <span role="alert"> {slot.error}</span>}
            <button
              type="button"
              onClick={() => removeImage(slot)}
              disabled={submitting}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div>
        <label htmlFor="caption">Caption</label>
        <textarea
          id="caption"
          maxLength={2200}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          maxLength={255}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!canSubmit}>
        {submitting ? 'Posting…' : 'Share'}
      </button>
    </form>
  );
}
