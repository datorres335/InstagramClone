import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { HelperText } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../../components/post-card';
import { EmptyState } from '../../components/ui/empty-state';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/**
 * `GET /me/saved` (docs/API.md §10, docs/FEATURES.md #13, Milestone 15) — the
 * caller's own saved posts, newest first. A flat route under `profile/`
 * (matching `followers.tsx`/`following.tsx`/`edit.tsx`'s convention) rather
 * than nesting, reached via `Link` from the own-profile screen. Real
 * infinite scroll (`onEndReached`), the same convention `(tabs)/home.tsx`
 * established for the feed. Full post cards rather than a thumbnail grid, so
 * a post can be unsaved right here (docs/PROGRESS.md Milestone 25
 * deviations); the title is the stack header's.
 */
export default function SavedPostsScreen() {
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
      const saved = await apiClient.savedPosts.getSaved();
      setPosts(saved.data);
      setNextCursor(saved.meta.nextCursor);
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
      const saved = await apiClient.savedPosts.getSaved({
        cursor: nextCursor,
      });
      setPosts((prev) => [...prev, ...saved.data]);
      setNextCursor(saved.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  // A saved post can be the viewer's own (saving your own post is allowed),
  // so `PostCard`'s delete affordance can render here too — removes it from
  // this local list in place, the same `(tabs)/home.tsx` convention.
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
      testID="saved-posts-list"
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
        error ? (
          <HelperText type="error" accessibilityRole="alert">
            {error}
          </HelperText>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator
            testID="loading-indicator"
            color={colors.textSecondary}
            style={{ padding: 16 }}
          />
        ) : (
          <EmptyState icon="bookmark-border" message="No saved posts yet." />
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
