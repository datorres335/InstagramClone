'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import IconButton from '@mui/material/IconButton';
import { useState, useTransition } from 'react';

import { saveAction, unsaveAction } from './save-actions';

interface SaveButtonProps {
  postId: string;
  initialIsSaved: boolean;
}

/**
 * The bookmark toggle. Accessible name `Save`/`Unsave`, state in
 * `aria-pressed` (docs/ARCHITECTURE.md §5.5). Local component state, not
 * `router.refresh()` — the same reasoning `LikeButton` applies. No count:
 * saves are private.
 */
export function SaveButton({ postId, initialIsSaved }: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        if (isSaved) {
          await unsaveAction(postId);
          setIsSaved(false);
        } else {
          await saveAction(postId);
          setIsSaved(true);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <span className="flex items-center">
      {error && (
        <span role="alert" className="mr-2 text-caption text-error">
          {error}
        </span>
      )}
      <IconButton
        aria-label={isSaved ? 'Unsave' : 'Save'}
        aria-pressed={isSaved}
        onClick={handleClick}
        disabled={pending}
        className="text-text"
      >
        {isSaved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
      </IconButton>
    </span>
  );
}
