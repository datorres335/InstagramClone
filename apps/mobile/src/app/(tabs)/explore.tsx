import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PostResponse } from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';

const GRID_COLUMNS = 3;
const GRID_TILE_SIZE = 120;

/**
 * `GET /explore` (docs/API.md §11, docs/FEATURES.md #15, Milestone 18) —
 * a thumbnail grid, the same tile shape the profile grid
 * (`profile/[username].tsx`) already renders, reused here since
 * `ExploreResponse` carries full `PostResponse` items (first media item
 * per post), not the profile grid's `PostSummary.thumbnailUrl`. Real
 * infinite scroll (`onEndReached`), the same `(tabs)/home.tsx` convention —
 * unlike Milestone 17's search, Explore's ranking has a real, stable
 * keyset cursor.
 */
export default function ExploreScreen() {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const explore = await apiClient.posts.getExplore();
      setPosts(explore.data);
      setNextCursor(explore.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const explore = await apiClient.posts.getExplore({
        cursor: nextCursor,
      });
      setPosts((prev) => [...prev, ...explore.data]);
      setNextCursor(explore.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <FlatList
      testID="explore-grid"
      style={styles.container}
      data={posts}
      numColumns={GRID_COLUMNS}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => {
        const cover = item.media[0];
        return (
          <Pressable
            testID={`explore-tile-${item.id}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/post/[id]', params: { id: item.id } })
            }
          >
            {cover ? (
              <Image
                source={{ uri: cover.thumbnailUrl }}
                style={styles.gridTile}
              />
            ) : (
              <View style={[styles.gridTile, styles.gridTilePlaceholder]} />
            )}
          </Pressable>
        );
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            Explore
          </Text>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator
            testID="loading-indicator"
            style={styles.centered}
          />
        ) : (
          <Text style={styles.empty}>No posts to explore yet.</Text>
        )
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={styles.centered} /> : null
      }
      onEndReachedThreshold={0.5}
      onEndReached={handleLoadMore}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { padding: 16, gap: 12 },
  centered: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  empty: { padding: 16, textAlign: 'center', color: '#6b7280' },
  error: { color: '#dc2626' },
  gridTile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE,
    margin: 1,
  },
  gridTilePlaceholder: { backgroundColor: '#e5e7eb' },
});
