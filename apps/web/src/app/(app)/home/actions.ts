'use server';

import { redirect } from 'next/navigation';

import { getApiClient } from '../../../lib/get-api-client';

export async function logoutAction(): Promise<void> {
  await getApiClient().auth.logout();
  redirect('/login');
}
