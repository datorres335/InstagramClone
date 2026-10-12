import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Badge, HelperText, Text, TextInput } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import { formatTimeAgo } from '@instagram-clone/types';
import type { ConversationResponse } from '@instagram-clone/validation';

import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { TimeAgo } from '../../components/ui/time-ago';
import { UserAvatar } from '../../components/ui/user-avatar';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';
import { useRealtimeEvents } from '../../lib/realtime';
import { interFamily } from '../../theme/fonts';

/** "You: …" or "@sender: …" for the last message (apps/web's inbox prints the same). */
function messagePreview(
  conversation: ConversationResponse,
  viewerUsername: string | undefined,
): string {
  const last = conversation.lastMessage;
  if (!last) return 'No messages yet';
  const sender =
    last.sender.username === viewerUsername
      ? 'You'
      : `@${last.sender.username}`;
  return `${sender}: ${last.body}`;
}

/**
 * The inbox (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md M21/M22) —
 * mirrors `(tabs)/notifications.tsx`'s infinite-scroll pagination. Retrofits
 * M21's poll-based "new message" detection with M22's realtime push: a
 * `message` event or a stream (re)connect both re-fetch just the first
 * page, the same trade-off `apps/web`'s `ConversationsList` makes. The "new
 * message" input mirrors `apps/web`'s `StartConversationForm`.
 *
 * Rows match apps/web's: avatar, the other person's name, the last message
 * with its age, and the unread count as a primary `Badge`.
 */
export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationResponse[]>(
    [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [username, setUsername] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiClient.conversations.list();
      setConversations(page.data);
      setNextCursor(page.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const refreshFirstPage = useCallback(async () => {
    try {
      const page = await apiClient.conversations.list();
      setConversations((prev) => {
        const rest = prev.filter(
          (c) => !page.data.some((fresh) => fresh.id === c.id),
        );
        return [...page.data, ...rest];
      });
    } catch {
      // Silently ignored — mirrors the unread badge's own refresh-failure handling.
    }
  }, []);

  useRealtimeEvents((event) => {
    if (event.type === 'message') refreshFirstPage();
  }, refreshFirstPage);

  // The tab stays mounted while a thread is open on top of it, so coming back
  // refreshes page one: the thread just marked its messages read, and may
  // have sent one (reading pushes no realtime event).
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) refreshFirstPage();
      focusedBefore.current = true;
    }, [refreshFirstPage]),
  );

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiClient.conversations.list({ cursor: nextCursor });
      setConversations((prev) => [...prev, ...page.data]);
      setNextCursor(page.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleStartConversation() {
    const trimmed = username.trim();
    if (!trimmed) return;
    setError(null);
    setStarting(true);
    try {
      const conversation = await apiClient.conversations.start(trimmed);
      setUsername('');
      router.push({
        pathname: '/conversation/[id]',
        params: { id: conversation.id },
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setStarting(false);
    }
  }

  return (
    <FlatList
      testID="conversations-list"
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const other = item.otherParticipants[0];
        const title = other?.fullName ?? other?.username ?? 'unknown';
        const preview = messagePreview(item, user?.username);
        const unread = item.unreadCount > 0;
        const semibold = unread ? { fontFamily: interFamily.semibold } : null;
        return (
          <Link
            href={{ pathname: '/conversation/[id]', params: { id: item.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${title}, ${preview}, ${formatTimeAgo(item.lastMessageAt)}${unread ? `, ${item.unreadCount} unread` : ''}`}
              className="flex-row items-center gap-3 px-4 py-2"
            >
              <UserAvatar
                username={other?.username ?? '?'}
                avatarUrl={other?.avatarUrl ?? null}
                size="md"
              />
              <View className="flex-1">
                <Text variant="bodyMedium" numberOfLines={1} style={semibold}>
                  {title}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    style={[
                      {
                        flexShrink: 1,
                        color: unread ? colors.text : colors.textSecondary,
                      },
                      semibold,
                    ]}
                  >
                    {preview}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textSecondary }}
                  >
                    ·
                  </Text>
                  <TimeAgo iso={item.lastMessageAt} />
                </View>
              </View>
              {unread && (
                <Badge
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    fontFamily: interFamily.semibold,
                  }}
                >
                  {item.unreadCount}
                </Badge>
              )}
            </Pressable>
          </Link>
        );
      }}
      ListHeaderComponent={
        <View className="gap-3 px-4 py-3">
          <Text variant="titleLarge" role="heading">
            Messages
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              mode="outlined"
              dense
              label="New message to"
              accessibilityLabel="New message to"
              placeholder="username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1 }}
            />
            <Button
              mode="contained"
              onPress={handleStartConversation}
              disabled={starting || !username.trim()}
            >
              {starting ? 'Starting…' : 'Chat'}
            </Button>
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
            icon="chat-bubble-outline"
            message="No conversations yet."
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
