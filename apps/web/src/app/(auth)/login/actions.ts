'use server';

import { redirect } from 'next/navigation';

import { authErrorMessage } from '../../../lib/auth-error-message';
import type { AuthActionState } from '../../../lib/auth-action-state';
import { getApiClient } from '../../../lib/get-api-client';

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailOrUsername = String(formData.get('emailOrUsername') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  try {
    await getApiClient().auth.login({ emailOrUsername, password });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }

  redirect('/home');
}
