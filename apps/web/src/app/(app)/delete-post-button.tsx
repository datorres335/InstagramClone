'use client';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import IconButton from '@mui/material/IconButton';
import { useState, useTransition } from 'react';

import { deletePostAction } from './delete-post-actions';

interface DeletePostButtonProps {
  postId: string;
  authorUsername: string;
}

/**
 * The author's delete control in a post's header. Shared by the post detail
 * page (`/p/[id]`) and the home feed — promoted out of `p/[id]/` once the
 * feed became a second real consumer.
 */
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
    <span className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-caption text-error">
          {error}
        </span>
      )}
      <IconButton
        aria-label="Delete post"
        onClick={handleClick}
        disabled={pending}
        className="text-text-secondary hover:text-error"
      >
        <DeleteOutlineIcon />
      </IconButton>
    </span>
  );
}
