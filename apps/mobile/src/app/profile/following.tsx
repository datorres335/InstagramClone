import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { UserList } from '../../components/user-list';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

/** `GET /users/:username/following` (docs/API.md §5) — see `followers.tsx`'s note on the flat-route choice. */
export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [items, setItems] = useState<FollowListItemType[] | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    apiClient.follows.getFollowing(username).then((result) => {
      if (!cancelled) setItems(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <UserList
      items={items}
      emptyMessage="Not following anyone yet."
      viewerUsername={user?.username ?? null}
    />
  );
}
