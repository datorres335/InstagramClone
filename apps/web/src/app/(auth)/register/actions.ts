'use server';

import { redirect } from 'next/navigation';

import { authErrorMessage } from '../../../lib/auth-error-message';
import type { AuthActionState } from '../../../lib/auth-action-state';
import { getApiClient } from '../../../lib/get-api-client';

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  try {
    await getApiClient().auth.register({ email, username, password });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }

  redirect('/home');
}
