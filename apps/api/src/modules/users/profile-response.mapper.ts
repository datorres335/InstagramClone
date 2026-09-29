import type { User } from '@instagram-clone/prisma-client';
import type { PublicProfileResponse } from '@instagram-clone/validation';

/**
 * Maps a Prisma `User` row to the public profile shape (`docs/API.md` §4).
 * `avatarUrl`/`postsCount`/`followersCount`/`followingCount` are hardcoded
 * until `Media`/`Follow`/`Post` exist (Milestones 9–11 — see
 * `publicProfileResponseSchema`'s own doc comment); `isFollowedByMe` is
 * `null` for an anonymous viewer, `false` for an authenticated one (there's
 * no `Follow` table yet for it to ever be `true`).
 */
export function toPublicProfileResponse(
  user: User,
  isViewerAuthenticated: boolean,
): PublicProfileResponse {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    avatarUrl: null,
    isPrivate: user.isPrivate,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    isFollowedByMe: isViewerAuthenticated ? false : null,
    createdAt: user.createdAt.toISOString(),
  };
}
