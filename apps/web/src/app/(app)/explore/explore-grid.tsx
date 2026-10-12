'use client';

import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import Button from '@mui/material/Button';
import { useState, useTransition } from 'react';

import type { PostResponse } from '@instagram-clone/validation';

import { EmptyState } from '../../../components/ui/empty-state';
import { PostGrid } from '../post-grid';
import { getExplorePageAction } from './actions';

interface ExploreGridProps {
  initialPosts: PostResponse[];
  initialNextCursor: string | null;
}

/**
 * "Load more" pagination, mirroring `FeedList`/`SavedPostsList`/
 * `NotificationsList` (Milestone 12/15/16) — same reasoning: simpler than
 * an IntersectionObserver-based auto-load. The same `PostGrid` the profile
 * page renders, with each post's first photo as its tile — `ExploreResponse`
 * carries full `PostResponse` items (with a `media[]` array), not the
 * profile grid's minimal `PostSummary.thumbnailUrl`.
 */
export function ExploreGrid({
  initialPosts,
  initialNextCursor,
}: ExploreGridProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleLoadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const page = await getExplorePageAction(nextCursor ?? undefined);
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
        icon={<ExploreOutlinedIcon />}
        message="No posts to explore yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PostGrid
        posts={posts.map((post) => ({
          id: post.id,
          thumbnailUrl: post.media[0]?.thumbnailUrl ?? null,
        }))}
      />
      {nextCursor && (
        <Button
          variant="outlined"
          onClick={handleLoadMore}
          disabled={pending}
          className="self-center"
        >
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
