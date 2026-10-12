import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { HelperText, IconButton, Text } from 'react-native-paper';

import { colors, iconSize } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../../components/post-card';
import { EmptyState } from '../../components/ui/empty-state';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/**
 * The authenticated home feed (docs/API.md §7, docs/FEATURES.md #10) —
 * posts from followed accounts, newest first, never the viewer's own posts.
 *
 * Real infinite scroll (`onEndReached`), not a "Load more" button — mobile's
 * usual convention, unlike `apps/web`'s equivalent; `docs/
 * IMPLEMENTATION_PLAN.md` M12 explicitly offers both, so this is a
 * per-platform choice, not an inconsistency.
 *
 * Since Milestone 24 the header holds only the greeting and a "New post"
 * button: the unread count is a badge on the Notifications tab and Log out
 * lives in Settings, like apps/web's shell.
 *
 * Deleting a post from the feed removes it from the local list in place
 * rather than navigating away (unlike `post/[id].tsx`).
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await apiClient.posts.getFeed();
      setPosts(feed.data);
      setNextCursor(feed.meta.nextCursor);
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
      const feed = await apiClient.posts.getFeed({ cursor: nextCursor });
      setPosts((prev) => [...prev, ...feed.data]);
      setNextCursor(feed.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(postId: string) {
    setError(null);
    setDeletingId(postId);
    try {
      await apiClient.posts.remove(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <FlatList
      testID="feed-list"
      className="flex-1 bg-background"
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          isAuthor={item.author.username === user?.username}
          deleting={deletingId === item.id}
          error={null}
          onDelete={() => handleDelete(item.id)}
        />
      )}
      ListHeaderComponent={
        <View className="border-b border-border">
          <View className="flex-row items-center justify-between py-1 pr-1 pl-4">
            <Text variant="titleLarge" role="heading" numberOfLines={1}>
              Welcome, {user?.username}
            </Text>
            <IconButton
              icon="add-box"
              iconColor={colors.text}
              size={iconSize.lg}
              accessibilityLabel="New post"
              onPress={() => router.push('/post/new')}
            />
          </View>
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
          <EmptyState
            icon="photo-camera"
            message="No posts yet. Follow some accounts to see their posts here."
          />
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
