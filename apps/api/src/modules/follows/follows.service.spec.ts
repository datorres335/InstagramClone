import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { FollowsService } from './follows.service';

const fakeTarget = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  isPrivate: false,
  deletedAt: null,
};

function createDeps() {
  const prisma = {
    user: { findFirst: jest.fn() },
    follow: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const mediaService = {
    resolveAvatarUrl: jest.fn().mockReturnValue(null),
  };
  const service = new FollowsService(prisma as never, mediaService as never);
  return { service, prisma, mediaService };
}

describe('FollowsService', () => {
  describe('follow', () => {
    it('upserts the edge, idempotent by construction', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);

      await service.follow('user-1', 'bob');

      expect(prisma.follow.upsert).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 'user-1',
            followingId: 'user-2',
          },
        },
        create: { followerId: 'user-1', followingId: 'user-2' },
        update: {},
      });
    });

    it('rejects self-follow with ConflictException before touching the database', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue({ ...fakeTarget, id: 'user-1' });

      await expect(service.follow('user-1', 'alice')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.follow.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a username that does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.follow('user-1', 'nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('unfollow', () => {
    it('deletes the edge (a no-op if it never existed)', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);

      await service.unfollow('user-1', 'bob');

      expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
        where: { followerId: 'user-1', followingId: 'user-2' },
      });
    });

    it('throws NotFoundException for a username that does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.unfollow('user-1', 'nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getFollowCounts', () => {
    it('counts followers and following in parallel', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.count
        .mockResolvedValueOnce(5) // followers
        .mockResolvedValueOnce(2); // following

      const result = await service.getFollowCounts('user-1');

      expect(prisma.follow.count).toHaveBeenCalledWith({
        where: { followingId: 'user-1' },
      });
      expect(prisma.follow.count).toHaveBeenCalledWith({
        where: { followerId: 'user-1' },
      });
      expect(result).toEqual({ followers: 5, following: 2 });
    });
  });

  describe('isFollowing', () => {
    it('returns true when the edge exists', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findUnique.mockResolvedValue({ followerId: 'user-1' });

      await expect(service.isFollowing('user-1', 'user-2')).resolves.toBe(true);
    });

    it('returns false when the edge does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findUnique.mockResolvedValue(null);

      await expect(service.isFollowing('user-1', 'user-2')).resolves.toBe(
        false,
      );
    });
  });

  describe('getFollowers', () => {
    it("returns the target's followers with resolved avatarUrl and no nextCursor when the page isn't full", async () => {
      const { service, prisma, mediaService } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.follow.findMany.mockResolvedValue([
        {
          followerId: 'user-3',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          follower: {
            id: 'user-3',
            username: 'carol',
            fullName: 'Carol',
            avatarMedia: { id: 'media-1' },
          },
        },
      ]);
      mediaService.resolveAvatarUrl.mockReturnValue(
        'http://minio.test/avatar.webp',
      );

      const result = await service.getFollowers('bob', undefined, {
        limit: 20,
      });

      expect(prisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { followingId: 'user-2' },
          orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
          take: 21,
        }),
      );
      expect(result).toEqual({
        data: [
          {
            id: 'user-3',
            username: 'carol',
            fullName: 'Carol',
            avatarUrl: 'http://minio.test/avatar.webp',
            isFollowedByMe: null,
          },
        ],
        meta: { nextCursor: null },
      });
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      const row = (n: number) => ({
        followerId: `user-${n}`,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        follower: {
          id: `user-${n}`,
          username: `u${n}`,
          fullName: null,
          avatarMedia: null,
        },
      });
      prisma.follow.findMany.mockResolvedValue([row(1), row(2), row(3)]);

      const result = await service.getFollowers('bob', undefined, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('computes isFollowedByMe per row for an authenticated viewer, with a single extra query', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.follow.findMany
        .mockResolvedValueOnce([
          {
            followerId: 'user-3',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            follower: {
              id: 'user-3',
              username: 'carol',
              fullName: null,
              avatarMedia: null,
            },
          },
          {
            followerId: 'user-4',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            follower: {
              id: 'user-4',
              username: 'dave',
              fullName: null,
              avatarMedia: null,
            },
          },
        ])
        .mockResolvedValueOnce([{ followingId: 'user-3' }]); // the isFollowedByMe lookup

      const result = await service.getFollowers('bob', 'viewer-1', {
        limit: 20,
      });

      expect(prisma.follow.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.follow.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          followerId: 'viewer-1',
          followingId: { in: ['user-3', 'user-4'] },
        },
        select: { followingId: true },
      });
      expect(result.data[0].isFollowedByMe).toBe(true);
      expect(result.data[1].isFollowedByMe).toBe(false);
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);

      await expect(
        service.getFollowers('bob', undefined, {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.follow.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'user-9',
      });

      await service.getFollowers('bob', undefined, { cursor, limit: 20 });

      expect(prisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            followingId: 'user-2',
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                followerId: { lt: 'user-9' },
              },
            ],
          },
        }),
      );
    });
  });

  describe('getFollowing', () => {
    it('queries by followerId and orders/keys by followingId', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.follow.findMany.mockResolvedValue([
        {
          followingId: 'user-5',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          following: {
            id: 'user-5',
            username: 'eve',
            fullName: null,
            avatarMedia: null,
          },
        },
      ]);

      const result = await service.getFollowing('bob', undefined, {
        limit: 20,
      });

      expect(prisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { followerId: 'user-2' },
          orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
        }),
      );
      expect(result.data[0].username).toBe('eve');
    });
  });
});
