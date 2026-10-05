import { Link } from 'expo-router';
import { useState } from 'react';
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
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useRealtimeEvents(
    (event) => {
      if (event.type === 'notification') setCount((prev) => prev + 1);
    },
    () => {
      apiClient.notifications
        .getUnreadCount()
        .then((result) => setCount(result.count))
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
