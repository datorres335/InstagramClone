import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PostResponse } from '@instagram-clone/validation';

import { NotificationBadge } from '../../components/notification-badge';
import { PostCard } from '../../components/post-card';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/**
 * The authenticated home feed (docs/API.md §7, docs/FEATURES.md #10,
 * Milestone 12) — the stub welcome shell from earlier milestones now
 * renders real, fan-out-on-read content: posts from followed accounts,
 * newest first, never the viewer's own posts.
 *
 * Real infinite scroll (`onEndReached`), not a "Load more" button — mobile's
 * usual convention, unlike `apps/web`'s equivalent (a button is simpler to
 * reason about and test without a scroll-position API, and more idiomatic
 * for a web page); `docs/IMPLEMENTATION_PLAN.md` M12 explicitly offers both
 * as acceptable, so this is a per-platform choice, not an inconsistency.
 *
 * Deleting a post from the feed removes it from the local list in place
 * rather than navigating away (unlike `post/[id].tsx`, which navigates to
 * the author's profile after deleting) — better feed UX, and simple since
 * the feed already holds the full list in state.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, unread] = await Promise.all([
        apiClient.posts.getFeed(),
        apiClient.notifications.getUnreadCount(),
      ]);
      setPosts(feed.data);
      setNextCursor(feed.meta.nextCursor);
      setUnreadCount(unread.count);
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

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <FlatList
      testID="feed-list"
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
            Welcome, {user?.username}
          </Text>
          <Link href="/post/new">New post</Link>
          <NotificationBadge initialCount={unreadCount} />
          <Pressable
            style={styles.button}
            onPress={handleLogout}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Log out</Text>
          </Pressable>
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
          <Text style={styles.empty}>
            No posts yet. Follow some accounts to see their posts here.
          </Text>
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
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626' },
});
