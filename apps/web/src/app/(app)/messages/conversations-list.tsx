'use client';

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';

import type { ConversationResponse } from '@instagram-clone/validation';

import { EmptyState } from '../../../components/ui/empty-state';
import { TimeAgo } from '../../../components/ui/time-ago';
import { UserAvatar } from '../../../components/ui/user-avatar';
import { useRealtimeEvents } from '../../../lib/use-realtime-events';
import { getConversationsPageAction } from './actions';

interface ConversationsListProps {
  initialConversations: ConversationResponse[];
  initialNextCursor: string | null;
  viewerUsername: string;
}

/** "You: …" or "@sender: …" for the last message (mobile's inbox prints the same). */
function messagePreview(
  conversation: ConversationResponse,
  viewerUsername: string,
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
 * "load more" pagination mirrors `FeedList`/`NotificationsList`. Retrofits
 * M21's poll-based "new message" detection with M22's realtime push: a
 * `message` event (for any conversation — it only ever arrives for ones
 * the viewer participates in) or a stream (re)connect both re-fetch just
 * the first page, the same "refresh page one, don't disturb pagination
 * state further in" trade-off the original poll made. Re-fetching rather
 * than merging the pushed message directly in keeps `lastMessageAt`
 * reordering and `unreadCount` correct without duplicating that logic
 * here.
 *
 * Each row: avatar, the other person's name, the last message with its age,
 * and the unread count as a primary badge (with "unread" for screen readers).
 */
export function ConversationsList({
  initialConversations,
  initialNextCursor,
  viewerUsername,
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

  useRealtimeEvents((event) => {
    if (event.type === 'message') refreshFirstPage();
  }, refreshFirstPage);

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
    return (
      <EmptyState
        icon={<ChatBubbleOutlineIcon />}
        message="No conversations yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {conversations.map((conversation) => {
          const other = conversation.otherParticipants[0];
          const unread = conversation.unreadCount > 0;
          return (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface"
              >
                <UserAvatar
                  username={other?.username ?? '?'}
                  avatarUrl={other?.avatarUrl ?? null}
                  size="md"
                />
                {/* The {' '} text nodes don't affect the flex layout; they
                    keep the link's accessible name from running words
                    together ("Bob Builder @bob: hey · 2h, 3 unread"). */}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate ${unread ? 'font-semibold' : ''}`}>
                    {other?.fullName ?? other?.username ?? 'unknown'}
                  </span>{' '}
                  <span
                    className={`flex min-w-0 items-baseline gap-1 ${unread ? 'font-semibold text-text' : 'text-text-secondary'}`}
                  >
                    <span className="truncate">
                      {messagePreview(conversation, viewerUsername)}
                    </span>{' '}
                    <span aria-hidden="true">·</span>{' '}
                    <TimeAgo iso={conversation.lastMessageAt} />
                  </span>
                </span>
                {unread && (
                  <span className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-caption font-semibold text-on-primary">
                    <span aria-hidden="true">{conversation.unreadCount}</span>
                    <span className="sr-only">
                      , {conversation.unreadCount} unread
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <Button
          variant="outlined"
          onClick={handleLoadMore}
          disabled={pending}
          className="self-center"
        >
          {pending ? 'Loading…' : 'Load more'}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-center text-error">
          {error}
        </p>
      )}
    </div>
  );
}
