import Button from '@mui/material/Button';
import Link from 'next/link';

import { getApiClient } from '../../lib/get-api-client';
import { RealtimeProvider } from '../../lib/use-realtime-events';
import { AppNav } from './app-nav';

/**
 * The app shell (Milestone 23, docs/ARCHITECTURE.md §5.5). Doesn't redirect
 * anonymous visitors — profiles, post permalinks, likers/follower lists and
 * search are public, and each page still does its own auth check — it only
 * picks which chrome to show. Layouts persist across client-side navigation,
 * so these two API calls run on a full page load, not on every click.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();

  if (!user) {
    return (
      <>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <Link href="/login" className="text-title font-semibold">
            Instagram Clone
          </Link>
          <div className="flex gap-2">
            <Button href="/login" variant="contained">
              Log in
            </Button>
            <Button href="/register">Sign up</Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-content px-4 py-6">{children}</div>
      </>
    );
  }

  const unread = await apiClient.notifications.getUnreadCount();

  return (
    <RealtimeProvider>
      {/* Top bar backdrop on small screens; its contents live in AppNav. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-5 h-14 border-b border-border bg-background md:hidden"
      />
      <AppNav username={user.username} unreadCount={unread.count} />
      <div className="pt-14 pb-14 md:pt-0 md:pb-0 md:pl-(--ig-layout-nav-rail-width)">
        <div className="mx-auto w-full max-w-content px-4 py-6">{children}</div>
      </div>
    </RealtimeProvider>
  );
}
