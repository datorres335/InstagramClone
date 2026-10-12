'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

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
 *
 * Chat bubbles (Milestone 25): your own on the right in the primary color,
 * the other person's on the left on the surface color, each prefixed with
 * its sender for screen readers; "Seen" under your latest message once it's
 * read. The input bar sticks to the bottom of the viewport (above the phone
 * bottom bar), and the page scrolls to the newest message when one arrives.
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
  const endRef = useRef<HTMLDivElement>(null);

  const newestId = messages.at(-1)?.id;
  useEffect(() => {
    // Optional call: jsdom (unit tests) doesn't implement scrollIntoView.
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [newestId]);

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

  useRealtimeEvents((event) => {
    if (
      event.type !== 'message' ||
      event.message.conversationId !== conversationId
    ) {
      return;
    }
    if (!knownIds.current.has(event.message.id)) {
      knownIds.current.add(event.message.id);
      setMessages((prev) => [...prev, event.message]);
    }
  }, refreshNewest);

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

  const newest = messages.at(-1);
  const seenId =
    newest && newest.sender.username === viewerUsername && newest.readAt
      ? newest.id
      : null;

  return (
    <div className="flex flex-1 flex-col">
      {olderCursor && (
        <Button
          onClick={handleLoadOlder}
          disabled={pending}
          className="mt-2 self-center"
        >
          {pending ? 'Loading…' : 'Load older messages'}
        </Button>
      )}
      <ul className="flex flex-1 flex-col justify-end gap-1 py-4">
        {messages.map((message) => {
          const own = message.sender.username === viewerUsername;
          return (
            <li
              key={message.id}
              className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}
            >
              <p
                className={`max-w-3/4 rounded-lg px-3 py-2 whitespace-pre-line wrap-break-word ${
                  own
                    ? 'rounded-br-sm bg-primary text-on-primary'
                    : 'rounded-bl-sm bg-surface-variant text-text'
                }`}
              >
                <span className="sr-only">
                  {own ? 'You' : `@${message.sender.username}`}:{' '}
                </span>
                {message.body}
              </p>
              {message.id === seenId && (
                <span className="px-1 text-caption text-text-secondary">
                  Seen
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div ref={endRef} />
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-14 flex flex-col gap-1 border-t border-border bg-background py-3 md:bottom-0"
      >
        <div className="flex items-end gap-2">
          <TextField
            id="message-body"
            label="Message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            multiline
            maxRows={4}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 2200 } }}
          />
          <Button
            type="submit"
            disabled={pending || !body.trim()}
            className="shrink-0"
          >
            Send
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
