import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { NotificationResponse } from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';

function describeNotification(notification: NotificationResponse): string {
  switch (notification.type) {
    case 'FOLLOW':
      return `@${notification.actor.username} started following you.`;
    case 'LIKE':
      return `@${notification.actor.username} liked your post.`;
    case 'COMMENT':
      return `@${notification.actor.username} commented: "${
        notification.comment?.body ?? ''
      }"`;
  }
}

/**
 * `GET /notifications` (docs/API.md §12, docs/FEATURES.md #16, Milestone
 * 16) — mirrors `(tabs)/home.tsx`'s infinite-scroll pagination. Opening
 * this screen marks every notification as read (`docs/FEATURES.md` #16's
 * explicit UX), fired after the initial list load so this render still
 * reflects each notification's real pre-open `isRead` state.
 */
export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>(
    [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiClient.notifications.list();
      setNotifications(page.data);
      setNextCursor(page.meta.nextCursor);
      await apiClient.notifications.markRead();
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
      const page = await apiClient.notifications.list({ cursor: nextCursor });
      setNotifications((prev) => [...prev, ...page.data]);
      setNextCursor(page.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <FlatList
      testID="notifications-list"
      style={styles.container}
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Link
          href={
            item.post
              ? { pathname: '/post/[id]', params: { id: item.post.id } }
              : {
                  pathname: '/profile/[username]',
                  params: { username: item.actor.username },
                }
          }
        >
          <View style={styles.row}>
            <Text>{describeNotification(item)}</Text>
            {!item.isRead && <Text style={styles.new}> (new)</Text>}
          </View>
        </Link>
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            Notifications
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
          <Text style={styles.empty}>No notifications yet.</Text>
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
  row: { flexDirection: 'row', padding: 16, gap: 4 },
  new: { color: '#2563eb', fontWeight: '600' },
  error: { color: '#dc2626' },
});
