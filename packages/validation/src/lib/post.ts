import { z } from 'zod';

import { usernameSchema } from './user';

/** `POST /posts` (docs/API.md §7) — 1–10 items, array order = carousel order. */
export const createPostInputSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(2200, 'Caption must be at most 2200 characters')
    .nullable()
    .optional(),
  location: z
    .string()
    .trim()
    .max(255, 'Location must be at most 255 characters')
    .nullable()
    .optional(),
  mediaIds: z
    .array(z.uuid())
    .min(1, 'A post needs at least 1 image')
    .max(10, 'A post can have at most 10 images'),
});
export type CreatePostInput = z.infer<typeof createPostInputSchema>;

/** The minimal author shape embedded in a post or comment response — exported for `comment.ts`'s second real use of the identical shape (Milestone 14). */
export const postAuthorSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  fullName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
});

const postMediaItemSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  thumbnailUrl: z.url(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  blurhash: z.string().nullable(),
  altText: z.string().nullable(),
  position: z.number().int(),
});

/**
 * `GET /posts/:id` (docs/API.md §7) — `likesCount`/`commentsCount` are `0` and
 * `isLikedByMe`/`isSavedByMe` follow the same null-for-anonymous,
 * real-boolean-for-authenticated convention `isFollowedByMe` established
 * (Milestone 10) until `Like`/`SavedPost` exist (Milestones 13/15).
 */
export const postResponseSchema = z.object({
  id: z.uuid(),
  author: postAuthorSchema,
  caption: z.string().nullable(),
  location: z.string().nullable(),
  media: z.array(postMediaItemSchema),
  likesCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  isLikedByMe: z.boolean().nullable(),
  isSavedByMe: z.boolean().nullable(),
  createdAt: z.iso.datetime(),
});
export type PostResponse = z.infer<typeof postResponseSchema>;

/** A profile grid tile (`GET /users/:username/posts`, docs/API.md §4) — deliberately just enough to render the grid. */
export const postSummarySchema = z.object({
  id: z.uuid(),
  thumbnailUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
});
export type PostSummary = z.infer<typeof postSummarySchema>;

/**
 * `GET /feed` (docs/API.md §7, Milestone 12) — full `PostResponse` items, not
 * `PostSummary`: `docs/FEATURES.md` #10 says each feed item shows the whole
 * carousel/caption/counts inline, the same shape a post detail page needs.
 * Reuses `postResponseSchema` rather than a parallel "feed post" type.
 */
export const feedResponseSchema = z.object({
  data: z.array(postResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;
