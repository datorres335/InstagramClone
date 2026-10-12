'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialAuthActionState } from '../../../lib/auth-action-state';
import { deleteAccountAction } from './actions';
import { SettingsSection } from './settings-section';

/**
 * The first genuinely destructive, irreversible-from-the-UI action in this
 * codebase (docs/PROGRESS.md Milestone 19 deviations). Since Milestone 25 the
 * explicit second step is a confirmation dialog (it replaced M19's "I
 * understand" checkbox), and the already-required `currentPassword` field is
 * inside it — still not a type-to-confirm widget (no precedent for one in
 * this codebase, and the docs don't call for it).
 */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialAuthActionState,
  );
  const [open, setOpen] = useState(false);
  // React 19 resets the uncontrolled field after a failed attempt; remount it
  // so MUI's floating label matches (same fix as the auth forms, M23).
  const [resetKey, setResetKey] = useState(0);

  return (
    <SettingsSection id="delete-account-heading" title="Delete account">
      <p className="text-text-secondary">
        This permanently deletes your account. This cannot be undone from the
        app.
      </p>
      <Button
        variant="outlined"
        color="error"
        onClick={() => setOpen(true)}
        className="self-start"
      >
        Delete account
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        aria-labelledby="delete-account-dialog-title"
        fullWidth
        maxWidth="xs"
      >
        <form action={formAction} onReset={() => setResetKey((key) => key + 1)}>
          <DialogTitle id="delete-account-dialog-title">
            Delete your account?
          </DialogTitle>
          <DialogContent className="flex flex-col gap-4">
            <DialogContentText>
              This permanently deletes your account. This cannot be undone from
              the app. Enter your password to confirm.
            </DialogContentText>
            <TextField
              key={`deleteCurrentPassword-${resetKey}`}
              id="deleteCurrentPassword"
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              fullWidth
              autoFocus
            />
            {state.error && (
              <FormHelperText error role="alert">
                {state.error}
              </FormHelperText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={pending}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </SettingsSection>
  );
}
