import { notFound } from 'next/navigation';
import Link from 'next/link';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { DeletePostButton } from './delete-post-button';

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
      <Link href={`/${post.author.username}`}>@{post.author.username}</Link>
      {post.location && <p>{post.location}</p>}
      <ul>
        {post.media.map((item) => (
          <li key={item.id}>
            <img
              src={item.url}
              alt={item.altText ?? ''}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
            />
          </li>
        ))}
      </ul>
      {post.caption && <p>{post.caption}</p>}
      <p>
        {post.likesCount} likes · {post.commentsCount} comments
      </p>
      {isAuthor && (
        <DeletePostButton
          postId={post.id}
          authorUsername={post.author.username}
        />
      )}
    </main>
  );
}
