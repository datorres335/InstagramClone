'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { NotificationResponse } from '@instagram-clone/validation';

import { getNotificationsPageAction } from './actions';

interface NotificationsListProps {
  initialNotifications: NotificationResponse[];
  initialNextCursor: string | null;
}

function describeNotification(notification: NotificationResponse): string {
  switch (notification.type) {
    case 'FOLLOW':
      return `@${notification.actor.username} started following you.`;
    case 'LIKE':
      return `@${notification.actor.username} liked your post.`;
    case 'COMMENT':
      return `@${notification.actor.username} commented: "${
        notification.comment?.body ?? ''
      }"`;
  }
}

/**
 * "Load more" pagination, mirroring `FeedList`/`SavedPostsList` (Milestone
 * 12/15/16) — same reasoning: simpler than an IntersectionObserver-based
 * auto-load. Each notification's `isRead` reflects its state at the moment
 * the page loaded, before `NotificationsPage`'s server-side `markRead()`
 * call took effect — so "(new)" here means "was unread when you opened
 * this page," not a live value that updates again on this same view.
 */
export function NotificationsList({
  initialNotifications,
  initialNextCursor,
}: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getNotificationsPageAction(nextCursor ?? undefined);
        setNotifications((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError(
          'Something went wrong loading more notifications. Please try again.',
        );
      }
    });
  }

  if (notifications.length === 0) {
    return <p>No notifications yet.</p>;
  }

  return (
    <div>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>
            {notification.post ? (
              <Link href={`/p/${notification.post.id}`}>
                {describeNotification(notification)}
              </Link>
            ) : (
              <Link href={`/${notification.actor.username}`}>
                {describeNotification(notification)}
              </Link>
            )}
            {!notification.isRead && ' (new)'}
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button type="button" onClick={handleLoadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
