import { z } from 'zod';

/**
 * Shared by avatars and post images (docs/DATABASE.md §3.3) — both go
 * through the identical presign → upload → process pipeline
 * (docs/ARCHITECTURE.md §8).
 */
export const mediaPurposeSchema = z.enum(['AVATAR', 'POST_IMAGE']);
export type MediaPurpose = z.infer<typeof mediaPurposeSchema>;

export const mediaStatusSchema = z.enum(['PENDING', 'READY', 'FAILED']);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

/**
 * `POST /media/presign` (docs/API.md §6). Only the content-type allowlist is
 * validated here — the byte-size limit (docs/API.md §14: `413
 * payload-too-large`) is deliberately enforced in `MediaService`, not via
 * `.max()` here, so exceeding it produces the documented 413 rather than a
 * generic 400 `validation-failed`.
 */
export const presignMediaInputSchema = z.object({
  purpose: mediaPurposeSchema,
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  byteSize: z.number().int().positive(),
});
export type PresignMediaInput = z.infer<typeof presignMediaInputSchema>;

export const presignMediaResponseSchema = z.object({
  mediaId: z.uuid(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export type PresignMediaResponse = z.infer<typeof presignMediaResponseSchema>;

/** A fixed, code-defined key set — mirrors `Media.variants` (docs/DATABASE.md §3.3). */
export const mediaVariantsSchema = z.object({
  thumbnail: z.url(),
  feed: z.url(),
});
export type MediaVariants = z.infer<typeof mediaVariantsSchema>;

/**
 * `GET /media/:id` (docs/API.md §6) and the response of `POST
 * /media/:id/complete` / `PATCH /me/avatar`. `variants` is `null` until
 * `status` becomes `READY`.
 */
export const mediaResponseSchema = z.object({
  id: z.uuid(),
  purpose: mediaPurposeSchema,
  status: mediaStatusSchema,
  variants: mediaVariantsSchema.nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  blurhash: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type MediaResponse = z.infer<typeof mediaResponseSchema>;

/** `PATCH /me/avatar` (docs/API.md §4). */
export const updateAvatarInputSchema = z.object({
  mediaId: z.uuid(),
});
export type UpdateAvatarInput = z.infer<typeof updateAvatarInputSchema>;
