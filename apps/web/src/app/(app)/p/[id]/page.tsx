import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { PostCard } from '../../post-card';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Post detail view (docs/API.md §7, docs/IMPLEMENTATION_PLAN.md M11) — a
 * top-level `/p/:id` route (Instagram's own URL convention; nothing in the
 * docs specified one, so this is a judgment call — see docs/PROGRESS.md's
 * Milestone 11 deviations).
 */
export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const apiClient = getApiClient();

  let post;
  try {
    post = await apiClient.posts.getById(id);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await apiClient.auth.session();
  const isAuthor = viewer?.username === post.author.username;

  return (
    <main>
      <PostCard post={post} isAuthor={isAuthor} />
    </main>
  );
}
