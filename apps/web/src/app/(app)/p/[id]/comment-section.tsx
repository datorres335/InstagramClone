'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { CommentResponse } from '@instagram-clone/validation';

import { TimeAgo } from '../../../../components/ui/time-ago';
import { UserAvatar } from '../../../../components/ui/user-avatar';
import {
  createCommentAction,
  deleteCommentAction,
  getCommentsPageAction,
} from './comment-actions';

interface CommentSectionProps {
  postId: string;
  initialComments: CommentResponse[];
  initialNextCursor: string | null;
  viewerUsername: string | null;
  postAuthorUsername: string;
}

/**
 * The comment thread + add-comment form on the post detail page only (docs/
 * IMPLEMENTATION_PLAN.md M14) — not the feed; a comment thread doesn't fit a
 * feed card's compact shape the way the like button does (`PostCard`'s
 * comments count is just a link here, docs/FEATURES.md #12).
 */
export function CommentSection({
  postId,
  initialComments,
  initialNextCursor,
  viewerUsername,
  postAuthorUsername,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const comment = await createCommentAction(postId, { body: trimmed });
        setComments((prev) => [...prev, comment]);
        setBody('');
      } catch {
        setError(
          'Something went wrong posting your comment. Please try again.',
        );
      }
    });
  }

  function handleDelete(commentId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCommentAction(postId, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch {
        setError(
          'Something went wrong deleting that comment. Please try again.',
        );
      }
    });
  }

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getCommentsPageAction(
          postId,
          nextCursor ?? undefined,
        );
        setComments((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError(
          'Something went wrong loading more comments. Please try again.',
        );
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
      <h2 className="text-label font-semibold">Comments</h2>
      {comments.length === 0 ? (
        <p className="text-text-secondary">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const canDelete =
              viewerUsername === comment.author.username ||
              viewerUsername === postAuthorUsername;
            return (
              <li key={comment.id} className="flex gap-3">
                <UserAvatar
                  username={comment.author.username}
                  avatarUrl={comment.author.avatarUrl}
                  size="sm"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="whitespace-pre-line wrap-break-word">
                    <Link
                      href={`/${comment.author.username}`}
                      className="font-semibold hover:underline"
                    >
                      @{comment.author.username}
                    </Link>{' '}
                    {comment.body}
                  </p>
                  <div className="flex items-center gap-3">
                    <TimeAgo iso={comment.createdAt} />
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={pending}
                        className="text-caption font-semibold text-text-secondary hover:text-error disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor && (
        <Button
          variant="text"
          onClick={handleLoadMore}
          disabled={pending}
          className="self-start"
        >
          Load more comments
        </Button>
      )}
      {viewerUsername && (
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 border-t border-border pt-3"
        >
          <TextField
            id="comment-body"
            label="Add a comment"
            multiline
            maxRows={4}
            size="small"
            fullWidth
            value={body}
            onChange={(event) => setBody(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2200 } }}
          />
          <Button type="submit" disabled={pending || !body.trim()}>
            Post
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
    </section>
  );
}
