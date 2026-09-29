import { z } from 'zod';

import { usernameSchema } from './user';

/**
 * One entry in a followers/following list (`GET /users/:username/followers`,
 * `GET /users/:username/following` — docs/API.md §5). Deliberately narrower
 * than `PublicProfileResponse` (no `bio`/`websiteUrl`/counts) — a list entry
 * is a compact row, not a full profile card (docs/FEATURES.md #6:
 * "avatar/username/full name and... a follow/unfollow affordance").
 * `isFollowedByMe` follows the same null-for-anonymous convention as
 * `PublicProfileResponse` — it's what a client renders the inline
 * follow/unfollow affordance from.
 */
export const followListItemSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  fullName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  isFollowedByMe: z.boolean().nullable(),
});
export type FollowListItem = z.infer<typeof followListItemSchema>;

export const followListResponseSchema = z.object({
  data: z.array(followListItemSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type FollowListResponse = z.infer<typeof followListResponseSchema>;
