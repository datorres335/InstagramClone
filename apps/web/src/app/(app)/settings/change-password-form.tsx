'use client';

import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialSettingsActionState } from './action-state';
import { changePasswordAction } from './actions';
import { SettingsSection } from './settings-section';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialSettingsActionState,
  );
  // React 19 resets the uncontrolled fields after the action; remount them
  // so MUI's floating labels match (same fix as the auth forms, M23).
  const [resetKey, setResetKey] = useState(0);

  return (
    <SettingsSection id="change-password-heading" title="Change password">
      <form
        action={formAction}
        onReset={() => setResetKey((key) => key + 1)}
        className="flex flex-col gap-4"
      >
        <TextField
          key={`currentPassword-${resetKey}`}
          id="currentPassword"
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          fullWidth
        />
        <TextField
          key={`newPassword-${resetKey}`}
          id="newPassword"
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          helperText="At least 8 characters."
          slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }}
        />
        {state.error && (
          <FormHelperText error role="alert">
            {state.error}
          </FormHelperText>
        )}
        {state.success && (
          <p role="status" className="text-success">
            Password changed.
          </p>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={pending}
          className="self-start"
        >
          {pending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </SettingsSection>
  );
}
