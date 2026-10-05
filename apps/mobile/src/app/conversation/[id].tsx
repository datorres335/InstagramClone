import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '@instagram-clone/api-client';
import type { MessageResponse } from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';
import { useRealtimeEvents } from '../../lib/realtime';

/**
 * The conversation thread (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md
 * M21/M22) — see `apps/web`'s `/messages/[id]` equivalent for the full
 * newest-first-query/chronological-render reasoning; this screen mirrors it
 * exactly, just as a `FlatList` (inverted, the standard RN chat-list idiom:
 * index 0 renders at the bottom) instead of a plain `<ul>`. Also mirrors its
 * realtime retrofit: a `message` event for this conversation is appended
 * directly, while a stream (re)connect re-fetches the newest page to catch
 * up on anything missed while disconnected.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
  const [otherUsername, setOtherUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const knownIds = useRef(new Set<string>());

  const loadThread = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [conversation, page] = await Promise.all([
        apiClient.conversations.get(id),
        apiClient.conversations.listMessages(id),
      ]);
      setOtherUsername(conversation.otherParticipants[0]?.username ?? null);
      setMessages(page.data);
      setOlderCursor(page.meta.nextCursor);
      knownIds.current = new Set(page.data.map((m) => m.id));
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        [403, 404].includes(caught.problem.status)
      ) {
        setNotFound(true);
      } else {
        setError(authErrorMessage(caught));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const refreshNewest = useCallback(async () => {
    try {
      const page = await apiClient.conversations.listMessages(id);
      const fresh = page.data.filter((m) => !knownIds.current.has(m.id));
      if (fresh.length > 0) {
        fresh.forEach((m) => knownIds.current.add(m.id));
        setMessages((prev) => [...prev, ...fresh]);
      }
    } catch {
      // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
    }
  }, [id]);

  useRealtimeEvents(
    (event) => {
      if (event.type !== 'message' || event.message.conversationId !== id) {
        return;
      }
      if (!knownIds.current.has(event.message.id)) {
        knownIds.current.add(event.message.id);
        setMessages((prev) => [...prev, event.message]);
      }
    },
    refreshNewest,
  );

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    setSending(true);
    try {
      const message = await apiClient.conversations.sendMessage(id, trimmed);
      knownIds.current.add(message.id);
      setMessages((prev) => [...prev, message]);
      setBody('');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  async function handleLoadOlder() {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await apiClient.conversations.listMessages(id, {
        cursor: olderCursor,
      });
      page.data.forEach((m) => knownIds.current.add(m.id));
      setMessages((prev) => [...page.data, ...prev]);
      setOlderCursor(page.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingOlder(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text role="heading">Conversation not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        @{otherUsername ?? 'unknown'}
      </Text>
      <FlatList
        testID="messages-list"
        inverted
        data={messages.slice().reverse()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.sender.username === viewer?.username
                ? styles.bubbleMine
                : styles.bubbleTheirs,
            ]}
          >
            <Text>{item.body}</Text>
          </View>
        )}
        ListFooterComponent={
          olderCursor ? (
            <Pressable
              onPress={handleLoadOlder}
              disabled={loadingOlder}
              accessibilityRole="button"
            >
              <Text style={styles.loadOlder}>
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </Text>
            </Pressable>
          ) : null
        }
      />
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          accessibilityLabel="Message"
          value={body}
          onChangeText={setBody}
          maxLength={2200}
          multiline
        />
        <Pressable
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending || !body.trim()}
          accessibilityRole="button"
        >
          <Text style={styles.sendButtonText}>
            {sending ? 'Sending…' : 'Send'}
          </Text>
        </Pressable>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', padding: 16 },
  loadOlder: { color: '#2563eb', textAlign: 'center', padding: 8 },
  bubble: { margin: 8, padding: 10, borderRadius: 12, maxWidth: '75%' },
  bubbleMine: { backgroundColor: '#dbeafe', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start' },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
  },
  sendButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendButtonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626', padding: 8 },
});
