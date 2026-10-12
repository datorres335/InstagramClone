'use client';

import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* The label is the visible picker, so `getByLabel('Photos')` and
          screen readers reach the hidden file input through it. */}
      <label
        htmlFor="images"
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-outline px-4 py-8 text-center ${
          images.length >= MAX_IMAGES
            ? 'opacity-50'
            : 'cursor-pointer hover:bg-surface'
        }`}
      >
        <AddPhotoAlternateOutlinedIcon
          aria-hidden="true"
          className="size-12 text-text-secondary"
        />
        <span className="font-semibold text-primary">Add photos</span>
        <span className="text-caption text-text-secondary">
          JPEG, PNG or WebP, up to {MAX_IMAGES}
        </span>
        <input
          id="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesSelected}
          disabled={images.length >= MAX_IMAGES}
          className="sr-only"
        />
      </label>
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((slot, index) => (
            <li
              key={slot.previewUrl}
              className="relative overflow-hidden rounded-md bg-surface-variant"
            >
              <img
                src={slot.previewUrl}
                alt={`Selected photo ${index + 1}`}
                className="aspect-square w-full object-cover"
              />
              <IconButton
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => removeImage(slot)}
                disabled={submitting}
                size="small"
                className="absolute top-1 right-1 bg-background/80 hover:bg-background"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-background/85 px-2 py-1 text-caption">
                {(slot.status === 'uploading' ||
                  slot.status === 'processing') && (
                  <>
                    <span>
                      {slot.status === 'uploading'
                        ? 'Uploading…'
                        : 'Processing…'}
                    </span>
                    <LinearProgress aria-hidden="true" />
                  </>
                )}
                {slot.status === 'ready' && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircleIcon aria-hidden="true" fontSize="inherit" />
                    Ready
                  </span>
                )}
                {slot.status === 'error' && (
                  <span role="alert" className="text-error">
                    {slot.error}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <TextField
        id="caption"
        label="Caption"
        multiline
        minRows={3}
        maxRows={8}
        fullWidth
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 2200 } }}
      />
      <TextField
        id="location"
        label="Location"
        fullWidth
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      {error && (
        <FormHelperText error role="alert">
          {error}
        </FormHelperText>
      )}
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={!canSubmit}
      >
        {submitting ? 'Posting…' : 'Share'}
      </Button>
    </form>
  );
}
