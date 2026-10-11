'use client';

import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialAuthActionState } from '../../../lib/auth-action-state';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialAuthActionState,
  );
  // React 19 resets the (uncontrolled) fields after every form action, and
  // MUI's floating labels don't notice a native reset — remount the fields
  // so their labels match the now-empty inputs.
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      action={formAction}
      onReset={() => setResetKey((key) => key + 1)}
      className="flex flex-col gap-4"
    >
      <TextField
        key={`emailOrUsername-${resetKey}`}
        id="emailOrUsername"
        name="emailOrUsername"
        label="Email or username"
        type="text"
        autoComplete="username"
        required
        fullWidth
      />
      <TextField
        key={`password-${resetKey}`}
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        fullWidth
      />
      {state.error && (
        <FormHelperText error role="alert">
          {state.error}
        </FormHelperText>
      )}
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={pending}
      >
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  );
}
