'use client';

import { useState, useTransition } from 'react';

import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../post-card';
import { getFeedPageAction } from './actions';

interface FeedListProps {
  initialPosts: PostResponse[];
  initialNextCursor: string | null;
  viewerUsername: string;
}

/**
 * "Load more" pagination (docs/IMPLEMENTATION_PLAN.md M12 explicitly offers
 * this as an alternative to true infinite scroll) rather than an
 * IntersectionObserver-based auto-load — simpler, and there's no dedicated
 * scroll-position/loading-sentinel machinery to get right for one button.
 */
export function FeedList({
  initialPosts,
  initialNextCursor,
  viewerUsername,
}: FeedListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getFeedPageAction(nextCursor ?? undefined);
        setPosts((prev) => [...prev, ...page.data]);
        setNextCursor(page.meta.nextCursor);
      } catch {
        setError('Something went wrong loading more posts. Please try again.');
      }
    });
  }

  if (posts.length === 0) {
    return <p>No posts yet. Follow some accounts to see their posts here.</p>;
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
