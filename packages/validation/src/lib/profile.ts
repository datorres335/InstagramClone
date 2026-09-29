import { z } from 'zod';

import { usernameSchema } from './user';

/**
 * The public-facing profile shape (`docs/API.md` §4) — wider than
 * `userResponseSchema` (never includes `email`; does include avatar, the
 * post/follower/following counts, and `isFollowedByMe`).
 *
 * `avatarUrl`, `postsCount`, `followersCount`, and `followingCount` are
 * always `null`/`0` today: `Media` (avatars, Milestone 9), `Follow`
 * (Milestone 10), and `Post` (Milestone 11) don't exist yet. The schema
 * describes the shape this endpoint will have once those land — declaring
 * it now, rather than after, means `apps/web`/`apps/mobile` don't need a
 * breaking response-shape change later for fields that were always part of
 * the documented contract (`docs/API.md` §4 predates this milestone).
 */
export const publicProfileResponseSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  fullName: z.string().nullable(),
  bio: z.string().max(150).nullable(),
  websiteUrl: z.url().nullable(),
  avatarUrl: z.url().nullable(),
  isPrivate: z.boolean(),
  postsCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  /** `null` for an unauthenticated viewer (not computed); a real boolean once signed in. */
  isFollowedByMe: z.boolean().nullable(),
  createdAt: z.iso.datetime(),
});
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;

/**
 * `PATCH /me` (`docs/API.md` §4/§13). Every field is optional (a PATCH, not
 * a PUT) and independently nullable where the underlying column is —
 * `null` clears the field, `undefined`/omitted leaves it untouched.
 */
export const updateProfileInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name cannot be blank')
    .max(150)
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(150, 'Bio must be at most 150 characters')
    .nullable()
    .optional(),
  websiteUrl: z.url('Website must be a valid URL').nullable().optional(),
  isPrivate: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

/**
 * `GET /users/:username/posts` (`docs/API.md` §4) — always empty until
 * `Post` exists (Milestone 11). `z.never()` makes that honest at the type
 * level too, not just in the current implementation: `data` can only ever
 * be `[]`, and a non-empty array would fail to validate rather than being
 * silently accepted. The `cursor`/`limit` query params are still accepted
 * and validated (`paginationQuerySchema`) even though they don't affect
 * anything yet, so this endpoint's call signature doesn't change once
 * Milestone 11 gives it something real to paginate.
 */
export const userPostsResponseSchema = z.object({
  data: z.array(z.never()),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type UserPostsResponse = z.infer<typeof userPostsResponseSchema>;
