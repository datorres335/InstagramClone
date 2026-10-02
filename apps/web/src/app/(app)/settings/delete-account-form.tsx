'use client';

import { useActionState, useState } from 'react';

import { initialAuthActionState } from '../../../lib/auth-action-state';
import { deleteAccountAction } from './actions';

/**
 * The first genuinely destructive, irreversible-from-the-UI action in this
 * codebase (docs/PROGRESS.md Milestone 19 deviations) — the confirmation
 * checkbox plus the already-required `currentPassword` field is the
 * deliberately minimal defense-in-depth chosen here, not a type-to-confirm
 * widget (no precedent for one in this codebase, and the docs don't call
 * for it).
 */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialAuthActionState,
  );
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={formAction}>
      <h2>Delete account</h2>
      <p>
        This permanently deletes your account. This cannot be undone from the
        app.
      </p>
      <div>
        <label htmlFor="deleteCurrentPassword">Current password</label>
        <input
          id="deleteCurrentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="confirmDelete">
          <input
            id="confirmDelete"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I understand this is permanent and cannot be undone.
        </label>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending || !confirmed}>
        {pending ? 'Deleting…' : 'Delete account'}
      </button>
    </form>
  );
}
