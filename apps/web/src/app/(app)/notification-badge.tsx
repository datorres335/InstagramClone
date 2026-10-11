'use client';

import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Badge from '@mui/material/Badge';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useRealtimeEvents } from '../../lib/use-realtime-events';
import { NavLink } from './nav-link';
import { getUnreadNotificationCountAction } from './notification-badge-actions';

interface NotificationBadgeProps {
  initialCount: number;
}

type SetCount = (update: (current: number) => number) => void;

/**
 * Re-fetches the real count. A push that lands while this request is in
 * flight may not be in the result yet (the count can be read just before the
 * notification row is written), so if any push arrived meanwhile, the larger
 * value wins instead of the possibly stale result overwriting it.
 */
function refreshCount(setCount: SetCount, pushes: { current: number }) {
  const pushesAtStart = pushes.current;
  getUnreadNotificationCountAction()
    .then((fetched) =>
      setCount((current) =>
        pushes.current === pushesAtStart ? fetched : Math.max(fetched, current),
      ),
    )
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
  const pushes = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/notifications') setCount(0);
  }, [pathname]);

  useRealtimeEvents(
    (event) => {
      if (event.type !== 'notification') return;
      pushes.current += 1;
      setCount((prev) => prev + 1);
    },
    () => refreshCount(setCount, pushes),
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
