import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { FollowListItem } from '../../components/follow-list-item';
import { apiClient } from '../../lib/api-client';

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

  if (items === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        Likes
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FollowListItem item={item} />}
        ListEmptyComponent={<Text>No likes yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
});
