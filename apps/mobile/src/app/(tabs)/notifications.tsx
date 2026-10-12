import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  View,
} from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { avatarSize, colors } from '@instagram-clone/design-tokens';
import { formatTimeAgo } from '@instagram-clone/types';
import type { NotificationResponse } from '@instagram-clone/validation';

import { EmptyState } from '../../components/ui/empty-state';
import { TimeAgo } from '../../components/ui/time-ago';
import { UserAvatar } from '../../components/ui/user-avatar';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { interFamily } from '../../theme/fonts';

/** What the actor did, after their `@username` (the sentence apps/web shows too). */
function describeAction(notification: NotificationResponse): string {
  switch (notification.type) {
    case 'FOLLOW':
      return 'started following you.';
    case 'LIKE':
      return 'liked your post.';
    case 'COMMENT':
      return `commented: "${notification.comment?.body ?? ''}"`;
  }
}

/**
 * `GET /notifications` (docs/API.md §12, docs/FEATURES.md #16, Milestone
 * 16) — mirrors `(tabs)/home.tsx`'s infinite-scroll pagination. Opening
 * this screen marks every notification as read (`docs/FEATURES.md` #16's
 * explicit UX), fired after the initial list load so this render still
 * reflects each notification's real pre-open `isRead` state.
 *
 * Rows match apps/web's `NotificationsList`: avatar, sentence, age, the
 * post's thumbnail for likes and comments, and for unread rows a primary
 * dot, semibold text and "Unread" in the row's accessibility label.
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

  // The tab stays mounted after its first visit, so each later visit reloads
  // the list and marks the new notifications read, matching the tab badge,
  // which resets whenever this screen opens.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) loadFirstPage();
      focusedBefore.current = true;
    }, [loadFirstPage]),
  );

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
      className="flex-1 bg-background"
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const unread = !item.isRead;
        const sentence = `@${item.actor.username} ${describeAction(item)}`;
        return (
          <Link
            href={
              item.post
                ? { pathname: '/post/[id]', params: { id: item.post.id } }
                : {
                    pathname: '/profile/[username]',
                    params: { username: item.actor.username },
                  }
            }
            asChild
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${unread ? 'Unread: ' : ''}${sentence} ${formatTimeAgo(item.createdAt)}`}
              className="flex-row items-center gap-3 px-4 py-2"
            >
              <UserAvatar
                username={item.actor.username}
                avatarUrl={item.actor.avatarUrl}
                size="md"
              />
              <View className="flex-1">
                <Text
                  variant="bodyMedium"
                  style={
                    unread ? { fontFamily: interFamily.semibold } : undefined
                  }
                >
                  <Text variant="labelLarge">@{item.actor.username}</Text>{' '}
                  {describeAction(item)}
                </Text>
                <TimeAgo iso={item.createdAt} />
              </View>
              {item.post &&
                (item.post.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.post.thumbnailUrl }}
                    style={{
                      width: avatarSize.md,
                      height: avatarSize.md,
                      backgroundColor: colors.surfaceVariant,
                    }}
                  />
                ) : (
                  <View
                    className="bg-surface-variant"
                    style={{ width: avatarSize.md, height: avatarSize.md }}
                  />
                ))}
              {unread && (
                <View
                  testID="unread-indicator"
                  className="h-2 w-2 rounded-full bg-primary"
                />
              )}
            </Pressable>
          </Link>
        );
      }}
      ListHeaderComponent={
        <View className="px-4 py-3">
          <Text variant="titleLarge" role="heading">
            Notifications
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
          <EmptyState icon="favorite-border" message="No notifications yet." />
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
