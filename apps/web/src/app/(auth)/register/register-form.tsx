'use client';

import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialAuthActionState } from '../../../lib/auth-action-state';
import { registerAction } from './actions';

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialAuthActionState,
  );
  // Same post-action reset handling as LoginForm.
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      action={formAction}
      onReset={() => setResetKey((key) => key + 1)}
      className="flex flex-col gap-4"
    >
      <TextField
        key={`email-${resetKey}`}
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        fullWidth
      />
      <TextField
        key={`username-${resetKey}`}
        id="username"
        name="username"
        label="Username"
        type="text"
        autoComplete="username"
        required
        fullWidth
        slotProps={{ htmlInput: { minLength: 3, maxLength: 30 } }}
      />
      <TextField
        key={`password-${resetKey}`}
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        fullWidth
        slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }}
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
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
