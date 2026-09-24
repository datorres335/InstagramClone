import { z } from 'zod';

import { usernameSchema, userResponseSchema } from './user';

/**
 * Length-only policy (8–128 chars), not mandated character classes.
 * Follows current guidance (NIST SP 800-63B) that arbitrary complexity
 * rules push users toward predictable substitutions without making
 * passwords meaningfully harder to guess — length is what matters most.
 * The upper bound is a defensive limit on hashing cost (argon2id is
 * applied at the API layer — see docs/ARCHITECTURE.md §7), not a security
 * rule in itself.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

// ---------------------------------------------------------------------------
// Request bodies (docs/API.md §3)
// ---------------------------------------------------------------------------

export const registerInputSchema = z.object({
  email: z.email(),
  username: usernameSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(150).optional(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Web sends no body — the refresh token travels only in the httpOnly
 * cookie. Mobile has no cookie, so it submits the token explicitly.
 * `refreshToken` is optional here for exactly that reason; the service
 * decides at runtime whether to read the cookie or the body.
 */
export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

/**
 * Same web-cookie/mobile-body split as `refreshInputSchema`, plus
 * `allDevices` for "log out everywhere" (docs/FEATURES.md #2).
 */
export const logoutInputSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  allDevices: z.boolean().optional(),
});
export type LogoutInput = z.infer<typeof logoutInputSchema>;

// ---------------------------------------------------------------------------
// Response bodies (docs/API.md §3)
// ---------------------------------------------------------------------------

/**
 * Shared by register (201) and login (200): a user plus a fresh access
 * token. `refreshToken` is present only for mobile responses — web gets it
 * via the httpOnly cookie instead (docs/ARCHITECTURE.md §7).
 */
export const authResponseSchema = z.object({
  user: userResponseSchema,
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** `POST /auth/refresh` response — a rotated access token (+ refresh token for mobile). */
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string().optional(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/** `GET /auth/session` response. */
export const sessionResponseSchema = z.object({
  user: userResponseSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
