import Link from 'next/link';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { FollowButton } from './follow-button';

/**
 * One row of a followers/following list (docs/FEATURES.md #6: "avatar/
 * username/full name and... a follow/unfollow affordance inline"), reused
 * verbatim for a post's likers list (Milestone 13 — `GET /posts/:postId/
 * likes` returns the identical `FollowListItem` shape, so no new type or
 * row component was introduced). The inline button renders for any
 * authenticated viewer, not only on their own list — `isFollowedByMe` is
 * already computed per-row regardless of whose list this is, so gating the
 * button to "your own list only" would be a strictly less useful subset of
 * what the API already supports (see docs/PROGRESS.md's Milestone 10
 * deviations).
 */
export function FollowListItem({ item }: { item: FollowListItemType }) {
  return (
    <li>
      {item.avatarUrl ? (
        <img
          src={item.avatarUrl}
          alt={item.username}
          width={40}
          height={40}
          style={{ borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#e5e7eb',
          }}
        />
      )}
      <Link href={`/${item.username}`}>
        {item.fullName
          ? `${item.fullName} (@${item.username})`
          : `@${item.username}`}
      </Link>
      {item.isFollowedByMe !== null && (
        <FollowButton
          username={item.username}
          initialIsFollowing={item.isFollowedByMe}
        />
      )}
    </li>
  );
}
