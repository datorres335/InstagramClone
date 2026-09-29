import type { User } from '@instagram-clone/prisma-client';
import type { PublicProfileResponse } from '@instagram-clone/validation';

/**
 * Maps a Prisma `User` row to the public profile shape (`docs/API.md` §4).
 * `postsCount` is still hardcoded until `Post` exists (Milestone 11) —
 * `avatarUrl` (Milestone 9) and `followersCount`/`followingCount`/
 * `isFollowedByMe` (Milestone 10, via `FollowsService`) are all real now.
 * `isFollowedByMe` is `null` for an anonymous viewer (never computed), a
 * real boolean for an authenticated one.
 */
export function toPublicProfileResponse(
  user: User,
  avatarUrl: string | null,
  followCounts: { followers: number; following: number },
  isFollowedByMe: boolean | null,
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
    followersCount: followCounts.followers,
    followingCount: followCounts.following,
    isFollowedByMe,
    createdAt: user.createdAt.toISOString(),
  };
}
