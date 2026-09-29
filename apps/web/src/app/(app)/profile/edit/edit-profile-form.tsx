'use client';

import { useActionState } from 'react';

import { initialAuthActionState } from '../../../../lib/auth-action-state';
import { updateProfileAction } from './actions';
import { AvatarUploader } from './avatar-uploader';

interface EditProfileFormProps {
  initial: {
    fullName: string | null;
    bio: string | null;
    websiteUrl: string | null;
    isPrivate: boolean;
  };
  currentAvatarUrl: string | null;
}

export function EditProfileForm({
  initial,
  currentAvatarUrl,
}: EditProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction}>
      <AvatarUploader currentAvatarUrl={currentAvatarUrl} />
      <div>
        <label htmlFor="fullName">Name</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          maxLength={150}
          defaultValue={initial.fullName ?? ''}
        />
      </div>
      <div>
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          name="bio"
          maxLength={150}
          defaultValue={initial.bio ?? ''}
        />
      </div>
      <div>
        <label htmlFor="websiteUrl">Website</label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          defaultValue={initial.websiteUrl ?? ''}
          placeholder="https://"
        />
      </div>
      <div>
        <label htmlFor="isPrivate">
          <input
            id="isPrivate"
            name="isPrivate"
            type="checkbox"
            defaultChecked={initial.isPrivate}
          />
          Private account
        </label>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
