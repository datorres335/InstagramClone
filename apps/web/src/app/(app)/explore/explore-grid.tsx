'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { PostResponse } from '@instagram-clone/validation';

import { getExplorePageAction } from './actions';

interface ExploreGridProps {
  initialPosts: PostResponse[];
  initialNextCursor: string | null;
}

/**
 * "Load more" pagination, mirroring `FeedList`/`SavedPostsList`/
 * `NotificationsList` (Milestone 12/15/16) — same reasoning: simpler than
 * an IntersectionObserver-based auto-load. A plain thumbnail grid (the
 * first media item per post), the same tile shape the profile grid
 * (`[username]/page.tsx`) already renders — adapted here since
 * `ExploreResponse` carries full `PostResponse` items (with a `media[]`
 * array), not the profile grid's minimal `PostSummary.thumbnailUrl`.
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
    return <p>No posts to explore yet.</p>;
  }

  return (
    <div>
      <ul>
        {posts.map((post) => {
          const cover = post.media[0];
          return (
            <li key={post.id}>
              <Link href={`/p/${post.id}`}>
                {cover ? (
                  <img
                    src={cover.thumbnailUrl}
                    alt={cover.altText ?? ''}
                    width={150}
                    height={150}
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 150,
                      height: 150,
                      backgroundColor: '#e5e7eb',
                    }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <button type="button" onClick={handleLoadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
