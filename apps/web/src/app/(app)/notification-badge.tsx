'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useRealtimeEvents } from '../../lib/use-realtime-events';
import { getUnreadNotificationCountAction } from './notification-badge-actions';

interface NotificationBadgeProps {
  initialCount: number;
}

/**
 * The unread badge (docs/API.md §12/§18, docs/FEATURES.md #16). Retrofits
 * Milestone 16's poll-based count with Milestone 22's realtime push:
 * increments optimistically the instant a `notification` event arrives,
 * and re-fetches the real count over REST on every (re)connect to stay
 * correct even if a push was missed while disconnected.
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useRealtimeEvents(
    (event) => {
      if (event.type === 'notification') setCount((prev) => prev + 1);
    },
    () => {
      getUnreadNotificationCountAction()
        .then(setCount)
        .catch(() => {
          // Silently ignored — this is a non-critical convenience number,
          // not worth surfacing an error for.
        });
    },
  );

  return (
    <Link href="/notifications">
      Notifications{count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
