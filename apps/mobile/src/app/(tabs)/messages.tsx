import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ConversationResponse } from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useRealtimeEvents } from '../../lib/realtime';

/**
 * The inbox (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md M21/M22) —
 * mirrors `(tabs)/notifications.tsx`'s infinite-scroll pagination. Retrofits
 * M21's poll-based "new message" detection with M22's realtime push: a
 * `message` event or a stream (re)connect both re-fetch just the first
 * page, the same trade-off `apps/web`'s `ConversationsList` makes. The "new
 * message" input mirrors `apps/web`'s `StartConversationForm`.
 */
export default function MessagesScreen() {
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
      // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
    }
  }, []);

  useRealtimeEvents(
    (event) => {
      if (event.type === 'message') refreshFirstPage();
    },
    refreshFirstPage,
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
      style={styles.container}
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const other = item.otherParticipants[0];
        return (
          <Link
            href={{ pathname: '/conversation/[id]', params: { id: item.id } }}
          >
            <View style={styles.row}>
              <Text style={styles.username}>
                @{other?.username ?? 'unknown'}
              </Text>
              {item.lastMessage && (
                <Text style={styles.preview}>{item.lastMessage.body}</Text>
              )}
              {item.unreadCount > 0 && (
                <Text style={styles.unread}> ({item.unreadCount})</Text>
              )}
            </View>
          </Link>
        );
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            Messages
          </Text>
          <View style={styles.newMessageRow}>
            <TextInput
              style={styles.input}
              placeholder="username"
              accessibilityLabel="New message to"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Pressable
              onPress={handleStartConversation}
              disabled={starting || !username.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.chatButton}>
                {starting ? 'Starting…' : 'Chat'}
              </Text>
            </Pressable>
          </View>
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
          <Text style={styles.empty}>No conversations yet.</Text>
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
  newMessageRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
  },
  chatButton: {
    color: '#2563eb',
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  empty: { padding: 16, textAlign: 'center', color: '#6b7280' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 4 },
  username: { fontWeight: '600' },
  preview: { color: '#374151' },
  unread: { color: '#2563eb', fontWeight: '600' },
  error: { color: '#dc2626' },
});
