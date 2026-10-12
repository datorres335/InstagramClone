import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { UserList } from '../../components/user-list';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

/**
 * `GET /posts/:postId/likes` (docs/API.md §8) — a flat route (not nested
 * under `post/[id]/`) reached via `router.push`/`Link` with `postId` as a
 * param, the same "converting an existing flat file into a directory is
 * more churn than benefit for one extra screen" reasoning
 * `profile/followers.tsx`/`following.tsx` already established (Milestone
 * 10). Reuses `FollowListItem` verbatim — a likers list row and a
 * followers/following list row are the identical shape.
 */
export default function PostLikesScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [items, setItems] = useState<FollowListItemType[] | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    apiClient.likes.getLikers(postId).then((result) => {
      if (!cancelled) setItems(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  return (
    <UserList
      items={items}
      emptyMessage="No likes yet."
      viewerUsername={user?.username ?? null}
    />
  );
}
