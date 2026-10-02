'use client';

import { useActionState } from 'react';

import { initialSettingsActionState } from './action-state';
import { changeEmailAction } from './actions';

interface ChangeEmailFormProps {
  currentEmail: string;
}

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [state, formAction, pending] = useActionState(
    changeEmailAction,
    initialSettingsActionState,
  );

  return (
    <form action={formAction}>
      <h2>Change email</h2>
      <p>Current email: {currentEmail}</p>
      <div>
        <label htmlFor="newEmail">New email</label>
        <input id="newEmail" name="newEmail" type="email" required />
      </div>
      <div>
        <label htmlFor="emailCurrentPassword">Current password</label>
        <input
          id="emailCurrentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p>Email changed.</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change email'}
      </button>
    </form>
  );
}
