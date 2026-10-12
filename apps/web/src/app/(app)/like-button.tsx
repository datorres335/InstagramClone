'use client';

import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import IconButton from '@mui/material/IconButton';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { likeAction, unlikeAction } from './like-actions';

interface LikeButtonProps {
  postId: string;
  initialIsLiked: boolean;
  initialLikesCount: number;
}

/**
 * The heart toggle plus its "N likes" link (docs/ARCHITECTURE.md §5.5). Its
 * accessible name stays `Like`/`Unlike` (what the e2e suite and screen
 * readers use) and `aria-pressed` carries the state.
 *
 * Local component state, not `router.refresh()` (unlike `FollowButton`) —
 * a like on a feed item shouldn't re-fetch the whole feed page, which would
 * discard `FeedList`'s "Load more" pagination state.
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
    <span className="flex items-center">
      <IconButton
        aria-label={isLiked ? 'Unlike' : 'Like'}
        aria-pressed={isLiked}
        onClick={handleClick}
        disabled={pending}
        className={isLiked ? 'text-like' : 'text-text'}
      >
        {isLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
      <Link
        href={`/p/${postId}/likes`}
        className="text-label font-semibold hover:underline"
      >
        {likesCount} likes
      </Link>
      {error && (
        <span role="alert" className="ml-2 text-caption text-error">
          {error}
        </span>
      )}
    </span>
  );
}
