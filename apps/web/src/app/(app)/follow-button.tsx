'use client';

import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { followAction, unfollowAction } from './follow-actions';

interface FollowButtonProps {
  username: string;
  initialIsFollowing: boolean;
  size?: 'small' | 'medium';
}

/**
 * Reused on the profile page itself, any followers/following list row, and
 * a post's likers list (docs/FEATURES.md #5/#6) — `username` is always the
 * *target* of the button. Filled primary "Follow", outlined "Unfollow" (the
 * same pairing as mobile). `router.refresh()` after a successful toggle
 * re-fetches the surrounding Server Component's follower/following counts
 * rather than duplicating them as client state here.
 */
export function FollowButton({
  username,
  initialIsFollowing,
  size = 'medium',
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
    <span className="flex flex-col items-end gap-1">
      <Button
        variant={isFollowing ? 'outlined' : 'contained'}
        color={isFollowing ? 'inherit' : 'primary'}
        size={size}
        onClick={handleClick}
        disabled={pending}
        className={isFollowing ? 'border-outline' : undefined}
      >
        {isFollowing ? 'Unfollow' : 'Follow'}
      </Button>
      {error && (
        <span role="alert" className="text-caption text-error">
          {error}
        </span>
      )}
    </span>
  );
}
