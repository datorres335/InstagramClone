'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { followAction, unfollowAction } from './follow-actions';

interface FollowButtonProps {
  username: string;
  initialIsFollowing: boolean;
}

/**
 * Reused on the profile page itself, any followers/following list row, and
 * a post's likers list (docs/FEATURES.md #5/#6) — `username` is always the
 * *target* of the button, not necessarily the page's own subject.
 * `router.refresh()` after a successful toggle re-fetches the surrounding
 * Server Component's data (follower/following counts) rather than
 * duplicating that count as client state here.
 */
export function FollowButton({
  username,
  initialIsFollowing,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        if (isFollowing) {
          await unfollowAction(username);
          setIsFollowing(false);
        } else {
          await followAction(username);
          setIsFollowing(true);
        }
        router.refresh();
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <span>
      <button type="button" onClick={handleClick} disabled={pending}>
        {isFollowing ? 'Unfollow' : 'Follow'}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
