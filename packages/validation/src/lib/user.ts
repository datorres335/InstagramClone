import { z } from 'zod';

/**
 * 3–30 chars, alphanumeric + underscore/period only (docs/FEATURES.md #1).
 * Case-insensitive *uniqueness* is enforced at the database level via
 * Postgres `citext` (docs/DATABASE.md §1) — this schema only constrains
 * shape, not uniqueness (that requires a DB round trip).
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9_.]+$/,
    'Username may only contain letters, numbers, underscores, and periods',
  );

/**
 * The safe, public-response shape of a `User` row — never includes
 * `passwordHash`, `tokenVersion`, `deletedAt`, or `emailVerifiedAt`. This is
 * the shape used in auth responses (`docs/API.md` §3); the richer public
 * *profile* shape (avatar, follower counts, `isFollowedByMe`) is a separate,
 * wider schema added in Milestone 8 when profile viewing is implemented —
 * this one only needs to describe "the caller's own user object."
 */
export const userResponseSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  email: z.email(),
  fullName: z.string().nullable(),
  bio: z.string().max(150).nullable(),
  websiteUrl: z.url().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;
