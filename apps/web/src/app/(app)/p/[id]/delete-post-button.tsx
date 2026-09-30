'use client';

import { useState, useTransition } from 'react';

import { deletePostAction } from './delete-post-actions';

interface DeletePostButtonProps {
  postId: string;
  authorUsername: string;
}

export function DeletePostButton({
  postId,
  authorUsername,
}: DeletePostButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePostAction(postId, authorUsername);
      } catch (caught) {
        if (
          caught &&
          typeof caught === 'object' &&
          'digest' in caught &&
          typeof caught.digest === 'string' &&
          caught.digest.startsWith('NEXT_REDIRECT')
        ) {
          throw caught;
        }
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending}>
        {pending ? 'Deleting…' : 'Delete post'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
