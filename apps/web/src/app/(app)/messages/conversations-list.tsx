'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import type { ConversationResponse } from '@instagram-clone/validation';

import { getConversationsPageAction } from './actions';

const POLL_INTERVAL_MS = 10_000;

interface ConversationsListProps {
  initialConversations: ConversationResponse[];
  initialNextCursor: string | null;
}

/**
 * The inbox (docs/API.md §17, docs/IMPLEMENTATION_PLAN.md M21) — "load more"
 * pagination mirrors `FeedList`/`NotificationsList`. Also polls the first
 * page on an interval, the poll-based "new message" detection M21 calls
 * for (matching `NotificationBadge`'s precedent, docs/ARCHITECTURE.md
 * non-goals — no WebSocket/SSE). A shorter interval than the 30s
 * notification badge uses: a chat inbox benefits more from low latency than
 * a generic badge count does. Only the first page is refreshed on poll —
 * any conversations the viewer has already paged into stay as they were,
 * the same trade-off every other "poll for freshness, don't disturb
 * pagination state" affordance in this codebase makes implicitly by not
 * polling at all; this one explicitly re-fetches just page one.
 */
export function ConversationsList({
  initialConversations,
  initialNextCursor,
}: ConversationsListProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const page = await getConversationsPageAction(undefined);
        setConversations((prev) => {
          const rest = prev.filter(
            (c) => !page.data.some((fresh) => fresh.id === c.id),
          );
          return [...page.data, ...rest];
        });
      } catch {
        // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getConversationsPageAction(nextCursor ?? undefined);
        setConversations((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError(
          'Something went wrong loading more conversations. Please try again.',
        );
      }
    });
  }

  if (conversations.length === 0) {
    return <p>No conversations yet.</p>;
  }

  return (
    <div>
      <ul>
        {conversations.map((conversation) => {
          const other = conversation.otherParticipants[0];
          return (
            <li key={conversation.id}>
              <Link href={`/messages/${conversation.id}`}>
                @{other?.username ?? 'unknown'}
                {conversation.lastMessage &&
                  `: ${conversation.lastMessage.body}`}
                {conversation.unreadCount > 0 &&
                  ` (${conversation.unreadCount})`}
              </Link>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <button type="button" onClick={handleLoadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
