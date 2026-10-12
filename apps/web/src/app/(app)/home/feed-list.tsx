'use client';

import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import Button from '@mui/material/Button';
import { useState, useTransition } from 'react';

import type { PostResponse } from '@instagram-clone/validation';

import { EmptyState } from '../../../components/ui/empty-state';
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
    return (
      <EmptyState
        icon={<PhotoCameraOutlinedIcon />}
        message="No posts yet. Follow some accounts to see their posts here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isAuthor={post.author.username === viewerUsername}
        />
      ))}
      {nextCursor && (
        <Button variant="outlined" onClick={handleLoadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-center text-error">
          {error}
        </p>
      )}
    </div>
  );
}
