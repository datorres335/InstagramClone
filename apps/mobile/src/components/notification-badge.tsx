import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { apiClient } from '../lib/api-client';

const POLL_INTERVAL_MS = 30_000;

interface NotificationBadgeProps {
  initialCount: number;
}

/**
 * Poll-based unread badge (docs/API.md §12, docs/FEATURES.md #16,
 * docs/ARCHITECTURE.md non-goals — no WebSocket/SSE transport), mirroring
 * `apps/web`'s `NotificationBadge`. `apiClient` is called directly (no
 * Server Action indirection needed on mobile). A failed poll is silently
 * ignored and just keeps the last known count — the same reasoning the web
 * equivalent documents.
 */
export function NotificationBadge({ initialCount }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await apiClient.notifications.getUnreadCount();
        setCount(result.count);
      } catch {
        // Silently ignored — see the doc comment above.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/notifications">
      <Text>Notifications{count > 0 ? ` (${count})` : ''}</Text>
    </Link>
  );
}
