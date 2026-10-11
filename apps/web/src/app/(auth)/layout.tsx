import { redirect } from 'next/navigation';

import { getApiClient } from '../../lib/get-api-client';

/** Already logged in? Skip the form — redirect straight to the authenticated shell. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getApiClient().auth.session();
  if (user) redirect('/home');
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      {children}
    </div>
  );
}
