'use server';

import { redirect } from 'next/navigation';

import { authErrorMessage } from '../../../lib/auth-error-message';
import type { AuthActionState } from '../../../lib/auth-action-state';
import { getApiClient } from '../../../lib/get-api-client';
import type { SettingsActionState } from './action-state';

export async function changePasswordAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  try {
    await getApiClient().users.changePassword({ currentPassword, newPassword });
  } catch (error) {
    return { error: authErrorMessage(error), success: false };
  }

  return { error: null, success: true };
}

export async function changeEmailAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const newEmail = String(formData.get('newEmail') ?? '').trim();
  const currentPassword = String(formData.get('currentPassword') ?? '');

  try {
    await getApiClient().users.changeEmail({ newEmail, currentPassword });
  } catch (error) {
    return { error: authErrorMessage(error), success: false };
  }

  return { error: null, success: true };
}

export async function deleteAccountAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const currentPassword = String(formData.get('currentPassword') ?? '');

  try {
    await getApiClient().users.deleteAccount({ currentPassword });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }

  redirect('/login');
}
