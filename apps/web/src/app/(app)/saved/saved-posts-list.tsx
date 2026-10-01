'use client';

import { useState, useTransition } from 'react';

import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../post-card';
import { getSavedPageAction } from './actions';

interface SavedPostsListProps {
  initialPosts: PostResponse[];
  initialNextCursor: string | null;
  viewerUsername: string;
}

/**
 * "Load more" pagination, mirroring `FeedList` (Milestone 12/15) — same
 * reasoning: simpler than an IntersectionObserver-based auto-load, and
 * there's no dedicated scroll-position/loading-sentinel machinery to get
 * right for one button.
 */
export function SavedPostsList({
  initialPosts,
  initialNextCursor,
  viewerUsername,
}: SavedPostsListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getSavedPageAction(nextCursor ?? undefined);
        setPosts((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError('Something went wrong loading more posts. Please try again.');
      }
    });
  }

  if (posts.length === 0) {
    return <p>No saved posts yet.</p>;
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isAuthor={post.author.username === viewerUsername}
        />
      ))}
      {nextCursor && (
        <button type="button" onClick={handleLoadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
