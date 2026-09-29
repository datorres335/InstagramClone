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

/** `GET /users/:username/following` (docs/API.md §5) — see `followers.tsx`'s note on the flat-route choice. */
export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [items, setItems] = useState<FollowListItemType[] | null>(null);

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
        Following
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FollowListItem item={item} />}
        ListEmptyComponent={<Text>Not following anyone yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
});
