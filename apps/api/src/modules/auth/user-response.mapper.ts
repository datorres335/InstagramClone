import type { User } from '@instagram-clone/prisma-client';
import type { UserResponse } from '@instagram-clone/validation';

/**
 * Maps a Prisma `User` row to the safe, "own-user" response shape
 * (`UserResponseSchema`, `packages/validation`) — never leaks
 * `passwordHash`/`tokenVersion`/`deletedAt`/`emailVerifiedAt`.
 */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    isPrivate: user.isPrivate,
    createdAt: user.createdAt.toISOString(),
  };
}
