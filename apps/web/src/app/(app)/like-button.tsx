'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { likeAction, unlikeAction } from './like-actions';

interface LikeButtonProps {
  postId: string;
  initialIsLiked: boolean;
  initialLikesCount: number;
}

/**
 * Local component state, not `router.refresh()` (unlike `FollowButton`) —
 * a like on a feed item shouldn't re-fetch the whole feed page, which would
 * discard `FeedList`'s "Load more" pagination state. Nothing else on the
 * page depends on fresh server data the way follower/following counts do.
 */
export function LikeButton({
  postId,
  initialIsLiked,
  initialLikesCount,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        if (isLiked) {
          await unlikeAction(postId);
          setIsLiked(false);
          setLikesCount((count) => count - 1);
        } else {
          await likeAction(postId);
          setIsLiked(true);
          setLikesCount((count) => count + 1);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <span>
      <button type="button" onClick={handleClick} disabled={pending}>
        {isLiked ? 'Unlike' : 'Like'}
      </button>{' '}
      <Link href={`/p/${postId}/likes`}>{likesCount} likes</Link>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
