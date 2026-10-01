import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getApiClient } from '../../../lib/get-api-client';
import { NotificationsList } from './notifications-list';

export const metadata = {
  title: 'Notifications',
};

/**
 * `GET /notifications` (docs/API.md §12, docs/FEATURES.md #16, Milestone
 * 16) — opening this page marks every notification as read
 * (`docs/FEATURES.md` #16's explicit UX: "marking as read happens on
 * opening the notifications screen"). The list is fetched first and
 * `markRead()` called after, so this render still reflects each
 * notification's real pre-open `isRead` state rather than showing
 * everything as already read the moment the page loads.
 */
export default async function NotificationsPage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const notifications = await apiClient.notifications.list();
  await apiClient.notifications.markRead();

  return (
    <main>
      <h1>Notifications</h1>
      <Link href="/home">Back to home</Link>
      <NotificationsList
        initialNotifications={notifications.data}
        initialNextCursor={notifications.meta.nextCursor}
      />
    </main>
  );
}
