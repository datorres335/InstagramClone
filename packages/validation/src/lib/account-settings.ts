import { z } from 'zod';

import { passwordSchema } from './auth';

/**
 * `POST /me/change-password` (docs/API.md §13) — `currentPassword` is
 * confirmed server-side before the change is applied (the same
 * defense-in-depth pattern as `changeEmailInputSchema`/
 * `deleteAccountInputSchema` below), and a successful change bumps
 * `User.tokenVersion`, invalidating every outstanding access token
 * (docs/FEATURES.md #17) — the response is a fresh token pair
 * (`RefreshResponse`, reused verbatim from `auth.ts`) so the *calling*
 * session keeps working without a re-login.
 */
export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

/**
 * `POST /me/change-email` (docs/API.md §13) — `currentPassword` required,
 * same reasoning as above. Response is `UserResponse` (the updated user),
 * the same shape `PATCH /me` already returns.
 */
export const changeEmailInputSchema = z.object({
  newEmail: z.email(),
  currentPassword: z.string().min(1, 'Current password is required'),
});
export type ChangeEmailInput = z.infer<typeof changeEmailInputSchema>;

/**
 * `DELETE /me` (docs/API.md §4/§13) — the docs don't specify a request
 * body for this route, but a `currentPassword` confirmation was added as a
 * deliberate decision (docs/PROGRESS.md Milestone 19 deviations): this is
 * the first genuinely destructive, irreversible-from-the-UI action in this
 * codebase, and the same defense-in-depth re-confirmation
 * `changePasswordInputSchema`/`changeEmailInputSchema` already require is
 * even more warranted here.
 */
export const deleteAccountInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;
