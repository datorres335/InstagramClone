import { encode } from 'blurhash';
import sharp from 'sharp';

/**
 * Fixed variant sizes (docs/ARCHITECTURE.md §8 point 3). `thumbnail` is
 * always a square center-crop — this is what makes the web upload path safe
 * without a custom crop widget (docs/FEATURES.md #4's client-side-crop note
 * only covers *avatar* uploads; a square crop is also exactly what post
 * grid thumbnails need, so applying it uniformly here needs no
 * purpose-specific branching). `feed` preserves the original aspect ratio,
 * only capped to fit within a max box.
 */
const THUMBNAIL_SIZE = 150;
const FEED_MAX_DIMENSION = 1080;
const BLURHASH_SAMPLE_SIZE = 32;
const BLURHASH_COMPONENTS = 4;

export interface MediaVariantResult {
  thumbnail: Buffer;
  feed: Buffer;
  width: number;
  height: number;
  blurhash: string;
}

/**
 * Pure image-processing step of the media pipeline (docs/ARCHITECTURE.md
 * §8 point 3) — deliberately has no knowledge of S3/Prisma/BullMQ, so it can
 * be unit-tested against a fixed input buffer in isolation. `MediaProcessor`
 * is the thin I/O wrapper around this.
 */
export async function generateMediaVariants(
  original: Buffer,
): Promise<MediaVariantResult> {
  const metadata = await sharp(original).metadata();

  const [thumbnail, feed, blurhash] = await Promise.all([
    sharp(original)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(original)
      .resize(FEED_MAX_DIMENSION, FEED_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer(),
    computeBlurhash(original),
  ]);

  return {
    thumbnail,
    feed,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    blurhash,
  };
}

async function computeBlurhash(original: Buffer): Promise<string> {
  const { data, info } = await sharp(original)
    .resize(BLURHASH_SAMPLE_SIZE, BLURHASH_SAMPLE_SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    BLURHASH_COMPONENTS,
    BLURHASH_COMPONENTS,
  );
}
