import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Link from 'next/link';

import type { PostResponse } from '@instagram-clone/validation';

import { TimeAgo } from '../../components/ui/time-ago';
import { UserAvatar } from '../../components/ui/user-avatar';
import { DeletePostButton } from './delete-post-button';
import { LikeButton } from './like-button';
import { MediaCarousel } from './media-carousel';
import { SaveButton } from './save-button';

interface PostCardProps {
  post: PostResponse;
  isAuthor: boolean;
}

/**
 * Shared post rendering for the post detail page (`/p/[id]`) and the home
 * feed (Milestone 12). Milestone 23–24 layout (docs/ARCHITECTURE.md §5.5):
 * author header, the photo carousel, then an action row in which each icon
 * sits next to its count (heart + "N likes", bubble + "N comments", bookmark
 * on the right), the caption, and the post's age. `apps/mobile`'s
 * `components/post-card.tsx` follows the same order.
 */
export function PostCard({ post, isAuthor }: PostCardProps) {
  const profileHref = `/${post.author.username}`;

  return (
    <article className="flex flex-col border-b border-border bg-background pb-3 md:rounded-lg md:border">
      <header className="flex items-center gap-3 px-3 py-2">
        <Link href={profileHref} tabIndex={-1} aria-hidden="true">
          <UserAvatar
            username={post.author.username}
            avatarUrl={post.author.avatarUrl}
            size="sm"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={profileHref}
            className="truncate text-label font-semibold hover:underline"
          >
            @{post.author.username}
          </Link>
          {post.location && (
            <p className="truncate text-caption text-text-secondary">
              {post.location}
            </p>
          )}
        </div>
        {isAuthor && (
          <DeletePostButton
            postId={post.id}
            authorUsername={post.author.username}
          />
        )}
      </header>

      <MediaCarousel media={post.media} />

      <div className="flex items-center gap-2 px-1 pt-1">
        {post.isLikedByMe === null ? (
          <span className="flex items-center gap-2 px-2">
            <FavoriteBorderIcon aria-hidden="true" />
            <Link
              href={`/p/${post.id}/likes`}
              className="text-label font-semibold hover:underline"
            >
              {post.likesCount} likes
            </Link>
          </span>
        ) : (
          <LikeButton
            postId={post.id}
            initialIsLiked={post.isLikedByMe}
            initialLikesCount={post.likesCount}
          />
        )}
        <Link
          href={`/p/${post.id}`}
          className="flex min-h-12 items-center gap-2 px-2 text-label font-semibold hover:underline"
        >
          <ChatBubbleOutlineIcon aria-hidden="true" />
          <span>{post.commentsCount} comments</span>
        </Link>
        <span className="flex-1" />
        {post.isSavedByMe !== null && (
          <SaveButton postId={post.id} initialIsSaved={post.isSavedByMe} />
        )}
      </div>

      <div className="flex flex-col gap-1 px-3">
        {post.caption && (
          <p className="whitespace-pre-line wrap-break-word">
            <Link href={profileHref} className="font-semibold hover:underline">
              @{post.author.username}
            </Link>{' '}
            {post.caption}
          </p>
        )}
        <TimeAgo iso={post.createdAt} />
      </div>
    </article>
  );
}
