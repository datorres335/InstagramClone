import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { apiClient } from './api-client';
import { useRealtimeEvents } from './realtime';

/**
 * The unread notification count for the tab bar badge (docs/API.md
 * §12/§18) — the mobile counterpart of apps/web's shell `NotificationBadge`.
 * Takes the real count over REST whenever the realtime stream (re)connects,
 * increments the instant a `notification` push arrives, and resets when the
 * Notifications tab opens (that screen marks everything read). A push that
 * lands while a re-fetch is in flight may not be in its result yet, so in
 * that case the larger value wins.
 */
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);
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
    () => {
      const pushesAtStart = pushes.current;
      apiClient.notifications
        .getUnreadCount()
        .then((result) =>
          setCount((current) =>
            pushes.current === pushesAtStart
              ? result.count
              : Math.max(result.count, current),
          ),
        )
        .catch(() => {
          // Non-critical convenience number; not worth surfacing an error.
        });
    },
  );

  return count;
}

/**
 * The Notifications tab's badge and accessible name for an unread count —
 * the same "Notifications (N)" name apps/web's nav item has.
 */
export function unreadTabBadge(count: number): {
  tabBarBadge: number | undefined;
  tabBarAccessibilityLabel: string;
} {
  return count > 0
    ? {
        tabBarBadge: count,
        tabBarAccessibilityLabel: `Notifications (${count})`,
      }
    : { tabBarBadge: undefined, tabBarAccessibilityLabel: 'Notifications' };
}
