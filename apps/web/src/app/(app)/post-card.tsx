import Link from 'next/link';

import type { PostResponse } from '@instagram-clone/validation';

import { DeletePostButton } from './delete-post-button';

interface PostCardProps {
  post: PostResponse;
  isAuthor: boolean;
}

/**
 * Shared post rendering — used by both the post detail page (`/p/[id]`) and
 * the home feed (`/home`, Milestone 12), the second real consumer that
 * justified extracting this out of `p/[id]/page.tsx`'s inline markup.
 *
 * Renders every image in the carousel as a plain stacked list, not a
 * swipeable widget — the same Milestone 11 deviation `/p/[id]` already had
 * (no carousel library in this repo's dependency tree); see
 * docs/PROGRESS.md's Milestone 11 deviations for the full reasoning.
 */
export function PostCard({ post, isAuthor }: PostCardProps) {
  return (
    <article>
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
    </article>
  );
}
