import type { Media } from '@instagram-clone/prisma-client';
import type { MediaResponse, MediaVariants } from '@instagram-clone/validation';

import type { StorageService } from '../../storage/storage.service';

/** The shape `Media.variants` is stored as once `status` is `READY` (storage keys, not URLs). */
interface StoredVariantKeys {
  thumbnail: string;
  feed: string;
}

export function toMediaResponse(
  media: Media,
  storage: StorageService,
): MediaResponse {
  return {
    id: media.id,
    purpose: media.purpose,
    status: media.status,
    variants: resolveVariantUrls(media, storage),
    width: media.width,
    height: media.height,
    blurhash: media.blurhash,
    failureReason: media.failureReason,
    createdAt: media.createdAt.toISOString(),
  };
}

/**
 * Resolves a `READY` avatar media's thumbnail variant to a public URL — used
 * for `User.avatarMediaId` everywhere it's surfaced (`GET /users/:username`
 * today; docs/API.md §4). `null` for anything not `READY` (a `PENDING`/
 * `FAILED` media should never have been set as anyone's avatar in the first
 * place — see `MediaService.setAsAvatar` — but this stays defensive rather
 * than assuming that invariant holds forever).
 */
export function resolveAvatarUrl(
  media: Media | null,
  storage: StorageService,
): string | null {
  const variants = resolveVariantUrls(media, storage);
  return variants ? variants.thumbnail : null;
}

function resolveVariantUrls(
  media: Media | null,
  storage: StorageService,
): MediaVariants | null {
  if (!media || media.status !== 'READY' || !media.variants) return null;
  const keys = media.variants as unknown as StoredVariantKeys;
  return {
    thumbnail: storage.getPublicUrl(keys.thumbnail),
    feed: storage.getPublicUrl(keys.feed),
  };
}
