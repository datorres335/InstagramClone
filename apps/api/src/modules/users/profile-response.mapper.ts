import type { User } from '@instagram-clone/prisma-client';
import type { PublicProfileResponse } from '@instagram-clone/validation';

/**
 * Maps a Prisma `User` row to the public profile shape (`docs/API.md` §4).
 * `postsCount`/`followersCount`/`followingCount` are still hardcoded until
 * `Follow`/`Post` exist (Milestones 10–11 — see
 * `publicProfileResponseSchema`'s own doc comment); `avatarUrl` resolves for
 * real as of Milestone 9 (`MediaService.resolveAvatarUrl`). `isFollowedByMe`
 * is `null` for an anonymous viewer, `false` for an authenticated one
 * (there's no `Follow` table yet for it to ever be `true`).
 */
export function toPublicProfileResponse(
  user: User,
  isViewerAuthenticated: boolean,
  avatarUrl: string | null,
): PublicProfileResponse {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    avatarUrl,
    isPrivate: user.isPrivate,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    isFollowedByMe: isViewerAuthenticated ? false : null,
    createdAt: user.createdAt.toISOString(),
  };
}
