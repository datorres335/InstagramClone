'use client';

import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialSettingsActionState } from './action-state';
import { changeEmailAction } from './actions';
import { SettingsSection } from './settings-section';

interface ChangeEmailFormProps {
  currentEmail: string;
}

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [state, formAction, pending] = useActionState(
    changeEmailAction,
    initialSettingsActionState,
  );
  // React 19 resets the uncontrolled fields after the action; remount them
  // so MUI's floating labels match (same fix as the auth forms, M23).
  const [resetKey, setResetKey] = useState(0);

  return (
    <SettingsSection id="change-email-heading" title="Change email">
      <p className="text-text-secondary">
        Current email: <span className="text-text">{currentEmail}</span>
      </p>
      <form
        action={formAction}
        onReset={() => setResetKey((key) => key + 1)}
        className="flex flex-col gap-4"
      >
        <TextField
          key={`newEmail-${resetKey}`}
          id="newEmail"
          name="newEmail"
          label="New email"
          type="email"
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          key={`emailCurrentPassword-${resetKey}`}
          id="emailCurrentPassword"
          name="currentPassword"
          label="Current password"
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
        {state.success && (
          <p role="status" className="text-success">
            Email changed.
          </p>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={pending}
          className="self-start"
        >
          {pending ? 'Saving…' : 'Change email'}
        </Button>
      </form>
    </SettingsSection>
  );
}
