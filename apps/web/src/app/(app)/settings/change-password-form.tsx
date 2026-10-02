'use client';

import { useActionState } from 'react';

import { initialSettingsActionState } from './action-state';
import { changePasswordAction } from './actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialSettingsActionState,
  );

  return (
    <form action={formAction}>
      <h2>Change password</h2>
      <div>
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p>Password changed.</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
