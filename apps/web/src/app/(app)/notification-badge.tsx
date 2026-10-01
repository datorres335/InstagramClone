'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getUnreadNotificationCountAction } from './notification-badge-actions';

const POLL_INTERVAL_MS = 30_000;

interface NotificationBadgeProps {
  initialCount: number;
}

/**
 * Poll-based unread badge (docs/API.md §12, docs/FEATURES.md #16,
 * docs/ARCHITECTURE.md non-goals — no WebSocket/SSE transport). Seeded with
 * a server-fetched `initialCount` so the badge is correct on first paint,
 * then refreshed on an interval. A failed poll is silently ignored and
 * just keeps the last known count until the next successful one — this is
 * a non-critical convenience number, not worth surfacing an error for.
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        setCount(await getUnreadNotificationCountAction());
      } catch {
        // Silently ignored — see the doc comment above.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/notifications">
      Notifications{count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
