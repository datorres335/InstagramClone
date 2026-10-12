import Link from 'next/link';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { UserAvatar } from '../../components/ui/user-avatar';
import { FollowButton } from './follow-button';

interface FollowListItemProps {
  item: FollowListItemType;
  /** The row is the signed-in viewer themself — no follow button. */
  isViewer?: boolean;
}

/**
 * One row of a followers/following list (docs/FEATURES.md #6), reused
 * verbatim for a post's likers list (Milestone 13 — the same
 * `FollowListItem` shape). The inline button renders for any authenticated
 * viewer, not only on their own list (docs/PROGRESS.md's Milestone 10
 * deviations) — except on the viewer's own row, where `isFollowedByMe` is a
 * self-check that is always false (fixed in Milestone 24).
 */
export function FollowListItem({
  item,
  isViewer = false,
}: FollowListItemProps) {
  return (
    <li className="flex items-center gap-3 py-2">
      <UserAvatar
        username={item.username}
        avatarUrl={item.avatarUrl}
        size="md"
      />
      <Link
        href={`/${item.username}`}
        className="flex min-w-0 flex-1 flex-col text-label font-semibold hover:underline"
      >
        @{item.username}
        {item.fullName && (
          <span className="truncate font-normal text-text-secondary">
            {item.fullName}
          </span>
        )}
      </Link>
      {item.isFollowedByMe !== null && !isViewer && (
        <FollowButton
          username={item.username}
          initialIsFollowing={item.isFollowedByMe}
          size="small"
        />
      )}
    </li>
  );
}
