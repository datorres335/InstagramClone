import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Text } from 'react-native';

import { apiClient } from '../lib/api-client';
import { useRealtimeEvents } from '../lib/realtime';

interface NotificationBadgeProps {
  initialCount: number;
}

/**
 * The unread badge (docs/API.md §12/§18, docs/FEATURES.md #16), mirroring
 * `apps/web`'s `NotificationBadge`. Retrofits the poll-based count with a
 * pushed `notification` event: increments optimistically the instant one
 * arrives, and re-fetches the real count over REST on every (re)connect.
 * A push that lands while that re-fetch is in flight may not be in its
 * result yet, so in that case the larger value wins.
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);
  const pushes = useRef(0);

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
          // Silently ignored — see the doc comment above.
        });
    },
  );

  return (
    <Link href="/notifications">
      <Text>Notifications{count > 0 ? ` (${count})` : ''}</Text>
    </Link>
  );
}
