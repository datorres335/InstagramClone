'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import type { MessageResponse } from '@instagram-clone/validation';

import { getMessagesPageAction, sendMessageAction } from '../actions';

const POLL_INTERVAL_MS = 5_000;

interface MessageThreadProps {
  conversationId: string;
  initialMessages: MessageResponse[];
  initialNextCursor: string | null;
  viewerUsername: string;
}

/**
 * The conversation thread view (docs/API.md §17, docs/IMPLEMENTATION_PLAN.md
 * M21). `GET .../messages` opens on the *newest* page (chronologically
 * ordered within it) and its `nextCursor` walks further into the past — the
 * same `lt`-keyset direction `FeedList`/`NotificationsList` already use, so
 * "load older" here prepends a page exactly the way their "load more"
 * appends one, just at the opposite end of the list. Also polls for new
 * incoming messages (the "poll-based new-message detection" M21 explicitly
 * calls for, no WebSocket/SSE until M22) by re-fetching the newest page and
 * appending anything not already known by id — correct as long as fewer
 * than a page's worth of messages (`limit`, default 20) arrive between
 * polls, a safe assumption at this MVP's expected chat volume. Polls more
 * frequently than the inbox list (5s vs. 10s) — an open thread is the one
 * place in this codebase latency is most noticeable.
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

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const page = await getMessagesPageAction(conversationId, undefined);
        const fresh = page.data.filter((m) => !knownIds.current.has(m.id));
        if (fresh.length > 0) {
          fresh.forEach((m) => knownIds.current.add(m.id));
          setMessages((prev) => [...prev, ...fresh]);
        }
      } catch {
        // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId]);

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
