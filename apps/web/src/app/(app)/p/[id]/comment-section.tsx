'use client';

import { useState, useTransition } from 'react';

import type { CommentResponse } from '@instagram-clone/validation';

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
    <section>
      <h2>Comments</h2>
      {comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul>
          {comments.map((comment) => {
            const canDelete =
              viewerUsername === comment.author.username ||
              viewerUsername === postAuthorUsername;
            return (
              <li key={comment.id}>
                <strong>@{comment.author.username}</strong> {comment.body}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    disabled={pending}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor && (
        <button type="button" onClick={handleLoadMore} disabled={pending}>
          Load more comments
        </button>
      )}
      {viewerUsername && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="comment-body">Add a comment</label>
          <textarea
            id="comment-body"
            maxLength={2200}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <button type="submit" disabled={pending || !body.trim()}>
            Post
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
