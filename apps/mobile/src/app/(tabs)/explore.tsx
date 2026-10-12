import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

import {
  PostTile,
  postGridListProps,
  usePostTileSize,
} from '../../components/post-grid';
import { EmptyState } from '../../components/ui/empty-state';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';

/**
 * `GET /explore` (docs/API.md §11, docs/FEATURES.md #15, Milestone 18) —
 * the same thumbnail grid as the profile screen (`components/post-grid.tsx`),
 * each post's first photo as its tile, since `ExploreResponse` carries full
 * `PostResponse` items, not the profile grid's `PostSummary.thumbnailUrl`.
 * Real infinite scroll (`onEndReached`), the same `(tabs)/home.tsx`
 * convention — unlike Milestone 17's search, Explore's ranking has a real,
 * stable keyset cursor.
 */
export default function ExploreScreen() {
  const tileSize = usePostTileSize();
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
      className="flex-1 bg-background"
      data={posts}
      {...postGridListProps}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => (
        <PostTile
          postId={item.id}
          thumbnailUrl={item.media[0]?.thumbnailUrl ?? null}
          size={tileSize}
          testID={`explore-tile-${item.id}`}
        />
      )}
      ListHeaderComponent={
        <View className="px-4 py-3">
          <Text variant="titleLarge" role="heading">
            Explore
          </Text>
          {error && (
            <HelperText type="error" accessibilityRole="alert">
              {error}
            </HelperText>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator
            testID="loading-indicator"
            color={colors.textSecondary}
            style={{ padding: 16 }}
          />
        ) : (
          <EmptyState icon="explore" message="No posts to explore yet." />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            color={colors.textSecondary}
            style={{ padding: 16 }}
          />
        ) : null
      }
      onEndReachedThreshold={0.5}
      onEndReached={handleLoadMore}
    />
  );
}
