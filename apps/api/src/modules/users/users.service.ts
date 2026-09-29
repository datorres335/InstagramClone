import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  PublicProfileResponse,
  UpdateProfileInput,
  UserPostsResponse,
  UserResponse,
} from '@instagram-clone/validation';

import { toUserResponse } from '../../common/mappers/user-response.mapper';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicProfileResponse } from './profile-response.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(
    username: string,
    viewerId: string | undefined,
  ): Promise<PublicProfileResponse> {
    const user = await this.findActiveUserByUsername(username);
    return toPublicProfileResponse(user, viewerId !== undefined);
  }

  /**
   * Always an empty page today — `Post` doesn't exist until Milestone 11
   * (see `userPostsResponseSchema`). Still confirms the user actually
   * exists first, so a typo'd username 404s instead of silently looking
   * like "this user just has no posts."
   */
  async getUserPosts(username: string): Promise<UserPostsResponse> {
    await this.findActiveUserByUsername(username);
    return { data: [], meta: { nextCursor: null } };
  }

  async updateOwnProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.websiteUrl !== undefined && { websiteUrl: input.websiteUrl }),
        ...(input.isPrivate !== undefined && { isPrivate: input.isPrivate }),
      },
    });
    return toUserResponse(user);
  }

  private async findActiveUserByUsername(username: string) {
    // Manual `deletedAt: null` filter, not a centralized Prisma Client
    // extension — docs/DATABASE.md §7 describes the latter as the eventual
    // design, but only one other service (auth) needs this check today;
    // worth centralizing once a third does (docs/PROGRESS.md).
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }
}
