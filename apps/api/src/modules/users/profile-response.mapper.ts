import type { User } from '@instagram-clone/prisma-client';
import type { PublicProfileResponse } from '@instagram-clone/validation';

/**
 * Maps a Prisma `User` row to the public profile shape (`docs/API.md` §4).
 * `avatarUrl` (Milestone 9), `followersCount`/`followingCount`/
 * `isFollowedByMe` (Milestone 10, via `FollowsService`), and `postsCount`
 * (Milestone 11, via `PostsService`) are all real now.
 * `isFollowedByMe` is `null` for an anonymous viewer (never computed), a
 * real boolean for an authenticated one.
 */
export function toPublicProfileResponse(
  user: User,
  avatarUrl: string | null,
  followCounts: { followers: number; following: number },
  isFollowedByMe: boolean | null,
  postsCount: number,
): PublicProfileResponse {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    avatarUrl,
    isPrivate: user.isPrivate,
    postsCount,
    followersCount: followCounts.followers,
    followingCount: followCounts.following,
    isFollowedByMe,
    createdAt: user.createdAt.toISOString(),
  };
}
