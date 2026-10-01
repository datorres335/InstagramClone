import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../../components/post-card';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/**
 * `GET /me/saved` (docs/API.md §10, docs/FEATURES.md #13, Milestone 15) — the
 * caller's own saved posts, newest first. A flat route under `profile/`
 * (matching `followers.tsx`/`following.tsx`/`edit.tsx`'s convention) rather
 * than nesting, reached via `Link` from the own-profile screen. Real
 * infinite scroll (`onEndReached`), the same convention `(tabs)/home.tsx`
 * established for the feed.
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
      style={styles.container}
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
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            Saved posts
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
          <Text style={styles.empty}>No saved posts yet.</Text>
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
});
