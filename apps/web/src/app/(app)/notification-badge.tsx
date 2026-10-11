'use client';

import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Badge from '@mui/material/Badge';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useRealtimeEvents } from '../../lib/use-realtime-events';
import { NavLink } from './nav-link';
import { getUnreadNotificationCountAction } from './notification-badge-actions';

interface NotificationBadgeProps {
  initialCount: number;
}

function refreshCount(setCount: (count: number) => void) {
  getUnreadNotificationCountAction()
    .then(setCount)
    .catch(() => {
      // Silently ignored — this is a non-critical convenience number,
      // not worth surfacing an error for.
    });
}

/**
 * The Notifications nav entry with its unread badge (docs/API.md §12/§18,
 * docs/FEATURES.md #16). Increments optimistically the instant a realtime
 * `notification` event arrives and re-fetches the real count on every
 * (re)connect. It lives in the persistent app shell (Milestone 23), which
 * doesn't re-render on client-side navigation, so it resets itself when
 * /notifications opens (that screen marks everything read).
 *
 * Deliberately no re-fetch on every navigation: Next runs a client's Server
 * Actions one at a time, so a count refresh fired on each page change would
 * sit in front of whatever the user does next on that page.
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/notifications') setCount(0);
  }, [pathname]);

  useRealtimeEvents(
    (event) => {
      if (event.type === 'notification') setCount((prev) => prev + 1);
    },
    () => refreshCount(setCount),
  );

  const withBadge = (icon: React.ReactNode) => (
    <Badge badgeContent={count} color="error" max={99}>
      {icon}
    </Badge>
  );

  return (
    <NavLink
      href="/notifications"
      label={`Notifications${count > 0 ? ` (${count})` : ''}`}
      icon={withBadge(<FavoriteBorderIcon />)}
      activeIcon={withBadge(<FavoriteIcon />)}
    />
  );
}
