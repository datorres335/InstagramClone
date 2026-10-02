import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getApiClient } from '../../../lib/get-api-client';
import { ChangeEmailForm } from './change-email-form';
import { ChangePasswordForm } from './change-password-form';
import { DeleteAccountForm } from './delete-account-form';

export const metadata = {
  title: 'Settings',
};

/**
 * Account settings (docs/API.md §13, docs/FEATURES.md #17, Milestone 19) —
 * one page, three independent forms, rather than three separate routes:
 * each is small enough that splitting them up would just be navigation
 * overhead for no real benefit (CLAUDE.md "avoid over-engineering").
 */
export default async function SettingsPage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  return (
    <main>
      <h1>Settings</h1>
      <Link href="/home">Back to home</Link>
      <ChangePasswordForm />
      <ChangeEmailForm currentEmail={user.email} />
      <DeleteAccountForm />
    </main>
  );
}
