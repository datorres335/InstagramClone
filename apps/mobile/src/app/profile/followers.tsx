import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { UserList } from '../../components/user-list';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

/**
 * `GET /users/:username/followers` (docs/API.md §5, docs/FEATURES.md #6). A
 * flat route (not nested under `[username]/`) reached via `router.push`
 * with `username` as a param — simpler than converting the existing flat
 * `profile/[username].tsx` file into a `[username]/` directory just for
 * this and `following.tsx` to nest under.
 */
export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [items, setItems] = useState<FollowListItemType[] | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    apiClient.follows.getFollowers(username).then((result) => {
      if (!cancelled) setItems(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <UserList
      items={items}
      emptyMessage="No followers yet."
      viewerUsername={user?.username ?? null}
    />
  );
}
