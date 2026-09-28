'use client';

import { useActionState } from 'react';

import { initialAuthActionState } from '../../../lib/auth-action-state';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="emailOrUsername">Email or username</label>
        <input
          id="emailOrUsername"
          name="emailOrUsername"
          type="text"
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
