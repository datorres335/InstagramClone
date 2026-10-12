'use client';

import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { NotificationResponse } from '@instagram-clone/validation';

import { EmptyState } from '../../../components/ui/empty-state';
import { TimeAgo } from '../../../components/ui/time-ago';
import { UserAvatar } from '../../../components/ui/user-avatar';
import { getNotificationsPageAction } from './actions';

interface NotificationsListProps {
  initialNotifications: NotificationResponse[];
  initialNextCursor: string | null;
}

/** What the actor did, after their `@username` (the sentence mobile shows too). */
function describeAction(notification: NotificationResponse): string {
  switch (notification.type) {
    case 'FOLLOW':
      return 'started following you.';
    case 'LIKE':
      return 'liked your post.';
    case 'COMMENT':
      return `commented: "${notification.comment?.body ?? ''}"`;
  }
}

/**
 * "Load more" pagination, mirroring `FeedList`/`SavedPostsList` (Milestone
 * 12/15/16) — same reasoning: simpler than an IntersectionObserver-based
 * auto-load. Each notification's `isRead` reflects its state at the moment
 * the page loaded, before `NotificationsPage`'s server-side `markRead()`
 * call took effect — so "unread" here means "was unread when you opened
 * this page," not a live value that updates again on this same view.
 *
 * Each row links to the post (likes, comments) or the actor's profile
 * (follows). Unread rows get a primary dot and semibold text, plus "Unread"
 * for screen readers (mobile's notifications tab is its twin).
 */
export function NotificationsList({
  initialNotifications,
  initialNextCursor,
}: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getNotificationsPageAction(nextCursor ?? undefined);
        setNotifications((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError(
          'Something went wrong loading more notifications. Please try again.',
        );
      }
    });
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<FavoriteBorderIcon />}
        message="No notifications yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {notifications.map((notification) => {
          const unread = !notification.isRead;
          return (
            <li key={notification.id}>
              <Link
                href={
                  notification.post
                    ? `/p/${notification.post.id}`
                    : `/${notification.actor.username}`
                }
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface"
              >
                <UserAvatar
                  username={notification.actor.username}
                  avatarUrl={notification.actor.avatarUrl}
                  size="md"
                />
                <p
                  className={`min-w-0 flex-1 wrap-break-word ${unread ? 'font-semibold' : ''}`}
                >
                  {unread && <span className="sr-only">Unread:</span>}{' '}
                  <span className="font-semibold">
                    @{notification.actor.username}
                  </span>{' '}
                  {describeAction(notification)}{' '}
                  <TimeAgo iso={notification.createdAt} />
                </p>
                {notification.post && (
                  <span className="size-avatar-md shrink-0 bg-surface-variant">
                    {notification.post.thumbnailUrl && (
                      <img
                        src={notification.post.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                )}
                {unread && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-primary"
                  />
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
