'use client';

import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';

import type { ConversationResponse } from '@instagram-clone/validation';

import { useRealtimeEvents } from '../../../lib/use-realtime-events';
import { getConversationsPageAction } from './actions';

interface ConversationsListProps {
  initialConversations: ConversationResponse[];
  initialNextCursor: string | null;
}

/**
 * The inbox (docs/API.md §17/§18, docs/IMPLEMENTATION_PLAN.md M21/M22) —
 * "load more" pagination mirrors `FeedList`/`NotificationsList`. Retrofits
 * M21's poll-based "new message" detection with M22's realtime push: a
 * `message` event (for any conversation — it only ever arrives for ones
 * the viewer participates in) or a stream (re)connect both re-fetch just
 * the first page, the same "refresh page one, don't disturb pagination
 * state further in" trade-off the original poll made. Re-fetching rather
 * than merging the pushed message directly in keeps `lastMessageAt`
 * reordering and `unreadCount` correct without duplicating that logic
 * here.
 */
export function ConversationsList({
  initialConversations,
  initialNextCursor,
}: ConversationsListProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refreshFirstPage = useCallback(() => {
    getConversationsPageAction(undefined)
      .then((page) => {
        setConversations((prev) => {
          const rest = prev.filter(
            (c) => !page.data.some((fresh) => fresh.id === c.id),
          );
          return [...page.data, ...rest];
        });
      })
      .catch(() => {
        // Silently ignored — mirrors NotificationBadge's own poll-failure handling.
      });
  }, []);

  useRealtimeEvents(
    (event) => {
      if (event.type === 'message') refreshFirstPage();
    },
    refreshFirstPage,
  );

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
