'use client';

import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useActionState, useState } from 'react';

import { initialAuthActionState } from '../../../../lib/auth-action-state';
import { updateProfileAction } from './actions';
import { AvatarUploader } from './avatar-uploader';

interface EditProfileFormProps {
  username: string;
  initial: {
    fullName: string | null;
    bio: string | null;
    websiteUrl: string | null;
    isPrivate: boolean;
  };
  currentAvatarUrl: string | null;
}

export function EditProfileForm({
  username,
  initial,
  currentAvatarUrl,
}: EditProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialAuthActionState,
  );
  // React 19 resets the uncontrolled fields after a failed submit; remount
  // them so MUI's floating labels match (same fix as the auth forms, M23).
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      action={formAction}
      onReset={() => setResetKey((key) => key + 1)}
      className="flex flex-col gap-5"
    >
      <AvatarUploader username={username} currentAvatarUrl={currentAvatarUrl} />
      <TextField
        key={`fullName-${resetKey}`}
        id="fullName"
        name="fullName"
        label="Name"
        defaultValue={initial.fullName ?? ''}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 150 } }}
      />
      <TextField
        key={`bio-${resetKey}`}
        id="bio"
        name="bio"
        label="Bio"
        defaultValue={initial.bio ?? ''}
        multiline
        minRows={2}
        maxRows={5}
        fullWidth
        helperText="Up to 150 characters."
        slotProps={{ htmlInput: { maxLength: 150 } }}
      />
      <TextField
        key={`websiteUrl-${resetKey}`}
        id="websiteUrl"
        name="websiteUrl"
        label="Website"
        type="url"
        defaultValue={initial.websiteUrl ?? ''}
        placeholder="https://"
        fullWidth
      />
      <FormControlLabel
        key={`isPrivate-${resetKey}`}
        control={
          <Switch
            id="isPrivate"
            name="isPrivate"
            defaultChecked={initial.isPrivate}
          />
        }
        label="Private account"
      />
      {state.error && (
        <FormHelperText error role="alert">
          {state.error}
        </FormHelperText>
      )}
      <Button
        type="submit"
        variant="contained"
        disabled={pending}
        className="self-start"
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
