import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@instagram-clone/api-client';
import { colors, radii } from '@instagram-clone/design-tokens';
import type { MessageResponse } from '@instagram-clone/validation';

import { Button } from '../../components/ui/button';
import { KeyboardAvoidingView } from '../../components/ui/keyboard-avoiding-view';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';
import { useRealtimeEvents } from '../../lib/realtime';

/** Own messages on the right in the primary color, the other person's on the left — the same bubbles as apps/web's `MessageThread`. */
function bubbleStyle(own: boolean) {
  return {
    alignSelf: own ? ('flex-end' as const) : ('flex-start' as const),
    maxWidth: '75%' as const,
    backgroundColor: own ? colors.primary : colors.surfaceVariant,
    borderRadius: radii.lg,
    borderBottomRightRadius: own ? radii.sm : radii.lg,
    borderBottomLeftRadius: own ? radii.lg : radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  };
}

/**
 * The conversation thread (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md
 * M21/M22) — see `apps/web`'s `/messages/[id]` equivalent for the full
 * newest-first-query/chronological-render reasoning; this screen mirrors it
 * exactly, just as a `FlatList` (inverted, the standard RN chat-list idiom:
 * index 0 renders at the bottom) instead of a plain `<ul>`. Also mirrors its
 * realtime retrofit: a `message` event for this conversation is appended
 * directly, while a stream (re)connect re-fetches the newest page to catch
 * up on anything missed while disconnected.
 *
 * The other person's `@username` is the stack header's title (Milestone 25);
 * the input bar sits at the bottom, above the keyboard
 * (`components/ui/keyboard-avoiding-view.tsx`) and the home indicator (the
 * root stack's bottom inset).
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
      // Silently ignored — mirrors the unread badge's own refresh-failure handling.
    }
  }, [id]);

  useRealtimeEvents((event) => {
    if (event.type !== 'message' || event.message.conversationId !== id) {
      return;
    }
    if (!knownIds.current.has(event.message.id)) {
      knownIds.current.add(event.message.id);
      setMessages((prev) => [...prev, event.message]);
    }
  }, refreshNewest);

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

  const header = (
    <Stack.Screen
      options={{ title: otherUsername ? `@${otherUsername}` : '' }}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {header}
        <ActivityIndicator
          testID="loading-indicator"
          color={colors.textSecondary}
        />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {header}
        <Text variant="titleLarge" role="heading">
          Conversation not found
        </Text>
      </View>
    );
  }

  const newest = messages.at(-1);
  const seenId =
    newest && newest.sender.username === viewer?.username && newest.readAt
      ? newest.id
      : null;

  return (
    <KeyboardAvoidingView className="flex-1 bg-background">
      {header}
      <FlatList
        testID="messages-list"
        inverted
        data={messages.slice().reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 4 }}
        renderItem={({ item }) => {
          const own = item.sender.username === viewer?.username;
          return (
            <View>
              <View
                accessible
                accessibilityLabel={`${own ? 'You' : `@${item.sender.username}`}: ${item.body}`}
                style={bubbleStyle(own)}
              >
                <Text
                  variant="bodyMedium"
                  style={{ color: own ? colors.onPrimary : colors.text }}
                >
                  {item.body}
                </Text>
              </View>
              {item.id === seenId && (
                <Text
                  variant="bodySmall"
                  style={{
                    alignSelf: 'flex-end',
                    color: colors.textSecondary,
                    paddingHorizontal: 4,
                  }}
                >
                  Seen
                </Text>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          olderCursor ? (
            <Button
              mode="text"
              onPress={handleLoadOlder}
              disabled={loadingOlder}
              style={{ alignSelf: 'center' }}
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </Button>
          ) : null
        }
      />
      <View className="gap-1 border-t border-border px-3 py-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            mode="outlined"
            dense
            label="Message"
            accessibilityLabel="Message"
            value={body}
            onChangeText={setBody}
            maxLength={2200}
            multiline
            style={{ flex: 1, maxHeight: 120 }}
          />
          <Button
            mode="text"
            onPress={handleSend}
            disabled={sending || !body.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </View>
        {error && (
          <HelperText type="error" accessibilityRole="alert">
            {error}
          </HelperText>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
