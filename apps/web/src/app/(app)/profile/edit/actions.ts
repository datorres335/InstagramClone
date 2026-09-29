'use server';

import { redirect } from 'next/navigation';

import { authErrorMessage } from '../../../../lib/auth-error-message';
import type { AuthActionState } from '../../../../lib/auth-action-state';
import { getApiClient } from '../../../../lib/get-api-client';

export async function updateProfileAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get('fullName') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
  const isPrivate = formData.get('isPrivate') === 'on';

  let updated;
  try {
    updated = await getApiClient().users.updateProfile({
      // A blank field means "the user cleared it" — every field is always
      // sent (this is a full edit form, not a partial-PATCH client), so
      // empty string unambiguously maps to null rather than "no change".
      fullName: fullName || null,
      bio: bio || null,
      websiteUrl: websiteUrl || null,
      isPrivate,
    });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }

  redirect(`/${updated.username}`);
}
