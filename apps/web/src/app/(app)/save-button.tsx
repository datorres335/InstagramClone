'use client';

import { useState, useTransition } from 'react';

import { saveAction, unsaveAction } from './save-actions';

interface SaveButtonProps {
  postId: string;
  initialIsSaved: boolean;
}

/**
 * Local component state, not `router.refresh()` — the same reasoning
 * `LikeButton` applies: a save on a feed item shouldn't re-fetch the whole
 * page and discard `FeedList`'s/`SavedPostsList`'s "Load more" pagination
 * state. No count to track here (unlike likes, saves are private — there's
 * no "N saves" to show anyone), just the boolean toggle.
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
    <span>
      <button type="button" onClick={handleClick} disabled={pending}>
        {isSaved ? 'Unsave' : 'Save'}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
