import { NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';

const fakeUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hash',
  fullName: 'Alice Anderson',
  bio: null,
  websiteUrl: null,
  isPrivate: false,
  tokenVersion: 0,
  emailVerifiedAt: null,
  avatarMediaId: null,
  avatarMedia: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

function createDeps() {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const mediaService = {
    resolveAvatarUrl: jest.fn().mockReturnValue(null),
    setAsAvatar: jest.fn(),
  };
  const followsService = {
    getFollowCounts: jest
      .fn()
      .mockResolvedValue({ followers: 0, following: 0 }),
    isFollowing: jest.fn().mockResolvedValue(false),
  };
  const service = new UsersService(
    prisma as never,
    mediaService as never,
    followsService as never,
  );
  return { service, prisma, mediaService, followsService };
}

describe('UsersService', () => {
  describe('getPublicProfile', () => {
    it('returns the public profile shape for an existing, active user', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.getPublicProfile('alice', undefined);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'alice', deletedAt: null },
        include: { avatarMedia: true },
      });
      expect(result).toEqual({
        id: 'user-1',
        username: 'alice',
        fullName: 'Alice Anderson',
        bio: null,
        websiteUrl: null,
        avatarUrl: null,
        isPrivate: false,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        isFollowedByMe: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('computes isFollowedByMe from FollowsService for an authenticated viewer', async () => {
      const { service, prisma, followsService } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);
      followsService.isFollowing.mockResolvedValue(true);

      const result = await service.getPublicProfile('alice', 'viewer-1');

      expect(followsService.isFollowing).toHaveBeenCalledWith(
        'viewer-1',
        'user-1',
      );
      expect(result.isFollowedByMe).toBe(true);
    });

    it('never calls FollowsService.isFollowing for an anonymous viewer', async () => {
      const { service, prisma, followsService } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.getPublicProfile('alice', undefined);

      expect(followsService.isFollowing).not.toHaveBeenCalled();
      expect(result.isFollowedByMe).toBeNull();
    });

    it('reports real follower/following counts from FollowsService', async () => {
      const { service, prisma, followsService } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);
      followsService.getFollowCounts.mockResolvedValue({
        followers: 12,
        following: 3,
      });

      const result = await service.getPublicProfile('alice', undefined);

      expect(followsService.getFollowCounts).toHaveBeenCalledWith('user-1');
      expect(result.followersCount).toBe(12);
      expect(result.followingCount).toBe(3);
    });

    it("resolves avatarUrl via MediaService from the user's avatarMedia relation", async () => {
      const { service, prisma, mediaService } = createDeps();
      const userWithAvatar = { ...fakeUser, avatarMedia: { id: 'media-1' } };
      prisma.user.findFirst.mockResolvedValue(userWithAvatar);
      mediaService.resolveAvatarUrl.mockReturnValue(
        'http://minio.test/media-1/thumbnail.webp',
      );

      const result = await service.getPublicProfile('alice', undefined);

      expect(mediaService.resolveAvatarUrl).toHaveBeenCalledWith(
        userWithAvatar.avatarMedia,
      );
      expect(result.avatarUrl).toBe('http://minio.test/media-1/thumbnail.webp');
    });

    it('never leaks email in the public profile', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.getPublicProfile('alice', undefined);

      expect(result).not.toHaveProperty('email');
    });

    it('throws NotFoundException for a username that does not exist (also covers soft-deleted users, since the deletedAt: null filter makes them indistinguishable from nonexistent here)', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('nobody', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getUserPosts', () => {
    it('returns an empty page for an existing user', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);

      await expect(service.getUserPosts('alice')).resolves.toEqual({
        data: [],
        meta: { nextCursor: null },
      });
    });

    it('throws NotFoundException for a username that does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getUserPosts('nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateOwnProfile', () => {
    it('updates only the fields explicitly present in the input', async () => {
      const { service, prisma } = createDeps();
      prisma.user.update.mockResolvedValue({ ...fakeUser, bio: 'New bio' });

      await service.updateOwnProfile('user-1', { bio: 'New bio' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { bio: 'New bio' },
      });
    });

    it('passes an explicit null through to clear a field', async () => {
      const { service, prisma } = createDeps();
      prisma.user.update.mockResolvedValue({ ...fakeUser, bio: null });

      await service.updateOwnProfile('user-1', { bio: null });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { bio: null },
      });
    });

    it('sends no data fields at all for an empty input', async () => {
      const { service, prisma } = createDeps();
      prisma.user.update.mockResolvedValue(fakeUser);

      await service.updateOwnProfile('user-1', {});

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {},
      });
    });

    it("returns the caller's own-user shape, including email", async () => {
      const { service, prisma } = createDeps();
      prisma.user.update.mockResolvedValue(fakeUser);

      const result = await service.updateOwnProfile('user-1', {});

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'alice@example.com',
      });
    });
  });

  describe('setAvatar', () => {
    it('delegates ownership/status validation and the User update to MediaService', async () => {
      const { service, mediaService } = createDeps();
      const mediaResponse = {
        id: 'media-1',
        purpose: 'AVATAR',
        status: 'READY',
        variants: { thumbnail: 'http://x/t.webp', feed: 'http://x/f.webp' },
        width: 300,
        height: 300,
        blurhash: 'hash',
        failureReason: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mediaService.setAsAvatar.mockResolvedValue(mediaResponse);

      const result = await service.setAvatar('user-1', 'media-1');

      expect(mediaService.setAsAvatar).toHaveBeenCalledWith(
        'user-1',
        'media-1',
      );
      expect(result).toEqual(mediaResponse);
    });
  });
});
