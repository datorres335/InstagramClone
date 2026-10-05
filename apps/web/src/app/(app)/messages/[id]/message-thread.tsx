'use client';

import { useCallback, useRef, useState, useTransition } from 'react';

import type { MessageResponse } from '@instagram-clone/validation';

import { useRealtimeEvents } from '../../../../lib/use-realtime-events';
import { getMessagesPageAction, sendMessageAction } from '../actions';

interface MessageThreadProps {
  conversationId: string;
  initialMessages: MessageResponse[];
  initialNextCursor: string | null;
  viewerUsername: string;
}

/**
 * The conversation thread view (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md
 * M21/M22). `GET .../messages` opens on the *newest* page (chronologically
 * ordered within it) and its `nextCursor` walks further into the past — the
 * same `lt`-keyset direction `FeedList`/`NotificationsList` already use, so
 * "load older" here prepends a page exactly the way their "load more"
 * appends one, just at the opposite end of the list.
 *
 * Retrofits M21's poll-based "new message" detection with M22's realtime
 * push: a `message` event for this conversation is appended directly
 * (it's already a full `MessageResponse`, the same shape this endpoint
 * returns), while a stream (re)connect re-fetches the newest page and
 * appends anything not already known by id — covering both "I was
 * connected the whole time" and "I missed some while disconnected"
 * without assuming either one.
 */
export function MessageThread({
  conversationId,
  initialMessages,
  initialNextCursor,
  viewerUsername,
}: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [olderCursor, setOlderCursor] = useState(initialNextCursor);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const knownIds = useRef(new Set(initialMessages.map((m) => m.id)));

  const refreshNewest = useCallback(() => {
    getMessagesPageAction(conversationId, undefined)
      .then((page) => {
        const fresh = page.data.filter((m) => !knownIds.current.has(m.id));
        if (fresh.length > 0) {
          fresh.forEach((m) => knownIds.current.add(m.id));
          setMessages((prev) => [...prev, ...fresh]);
        }
      })
      .catch(() => {
        // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
      });
  }, [conversationId]);

  useRealtimeEvents(
    (event) => {
      if (event.type !== 'message' || event.message.conversationId !== conversationId) {
        return;
      }
      if (!knownIds.current.has(event.message.id)) {
        knownIds.current.add(event.message.id);
        setMessages((prev) => [...prev, event.message]);
      }
    },
    refreshNewest,
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const message = await sendMessageAction(conversationId, trimmed);
        knownIds.current.add(message.id);
        setMessages((prev) => [...prev, message]);
        setBody('');
      } catch {
        setError(
          'Something went wrong sending your message. Please try again.',
        );
      }
    });
  }

  function handleLoadOlder() {
    if (!olderCursor) return;
    setError(null);
    startTransition(async () => {
      try {
        const page = await getMessagesPageAction(conversationId, olderCursor);
        page.data.forEach((m) => knownIds.current.add(m.id));
        setMessages((prev) => [...page.data, ...prev]);
        setOlderCursor(page.meta.nextCursor);
      } catch {
        setError(
          'Something went wrong loading older messages. Please try again.',
        );
      }
    });
  }

  return (
    <div>
      {olderCursor && (
        <button type="button" onClick={handleLoadOlder} disabled={pending}>
          {pending ? 'Loading…' : 'Load older messages'}
        </button>
      )}
      <ul>
        {messages.map((message) => (
          <li key={message.id}>
            <strong>@{message.sender.username}</strong> {message.body}
            {message.sender.username === viewerUsername &&
              message.readAt &&
              ' (seen)'}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor="message-body">Message</label>
        <textarea
          id="message-body"
          maxLength={2200}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" disabled={pending || !body.trim()}>
          Send
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
