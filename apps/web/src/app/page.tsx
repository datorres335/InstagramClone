import { redirect } from 'next/navigation';

import { getApiClient } from '../lib/get-api-client';

export default async function RootPage() {
  const user = await getApiClient().auth.session();
  redirect(user ? '/home' : '/login');
}
