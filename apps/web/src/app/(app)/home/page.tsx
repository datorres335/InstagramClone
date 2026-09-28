import { redirect } from 'next/navigation';

import { getApiClient } from '../../../lib/get-api-client';
import { logoutAction } from './actions';

export const metadata = {
  title: 'Home',
};

/**
 * The stub authenticated shell (docs/IMPLEMENTATION_PLAN.md M6) — real feed
 * content lands in Milestone 12. This page's job for now is just proving
 * the auth-check → protected-content → logout loop works end to end.
 */
export default async function HomePage() {
  const user = await getApiClient().auth.session();
  if (!user) redirect('/login');

  return (
    <main>
      <h1>Welcome, {user.username}</h1>
      <form action={logoutAction}>
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
