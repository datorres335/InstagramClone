/**
 * Distinct from `lib/auth-action-state.ts`'s `AuthActionState` — that shape
 * is error-only because its callers (`updateProfileAction`, register, login)
 * all redirect away on success. `changePasswordAction`/`changeEmailAction`
 * stay on `/settings` on success instead (docs/PROGRESS.md Milestone 19
 * deviations), so they need a visible success flag too.
 */
export interface SettingsActionState {
  error: string | null;
  success: boolean;
}

export const initialSettingsActionState: SettingsActionState = {
  error: null,
  success: false,
};
