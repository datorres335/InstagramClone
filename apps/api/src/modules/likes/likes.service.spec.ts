import { BadRequestException, NotFoundException } from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { LikesService } from './likes.service';

const fakeLiker = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarMedia: null,
};

function createDeps() {
  const prisma = {
    post: { findFirst: jest.fn() },
    like: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    follow: { findMany: jest.fn() },
  };
  const mediaService = {
    resolveAvatarUrl: jest.fn().mockReturnValue(null),
  };
  const service = new LikesService(prisma as never, mediaService as never);
  return { service, prisma, mediaService };
}

describe('LikesService', () => {
  describe('like', () => {
    it('upserts the like, idempotent by construction', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await service.like('user-1', 'post-1');

      expect(prisma.like.upsert).toHaveBeenCalledWith({
        where: { userId_postId: { userId: 'user-1', postId: 'post-1' } },
        create: { userId: 'user-1', postId: 'post-1' },
        update: {},
      });
    });

    it('throws NotFoundException for a missing or soft-deleted post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.like('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.like.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unlike', () => {
    it('deletes the like, idempotent whether or not it existed', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await service.unlike('user-1', 'post-1');

      expect(prisma.like.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', postId: 'post-1' },
      });
    });

    it('throws NotFoundException for a missing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.unlike('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getLikeStateForPosts', () => {
    it('returns an empty map without querying for an empty postIds array', async () => {
      const { service, prisma } = createDeps();

      const result = await service.getLikeStateForPosts([], 'user-1');

      expect(result.size).toBe(0);
      expect(prisma.like.groupBy).not.toHaveBeenCalled();
    });

    it('computes real counts and isLikedByMe for an authenticated viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.like.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: 3 },
        { postId: 'post-2', _count: 0 },
      ]);
      prisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }]);

      const result = await service.getLikeStateForPosts(
        ['post-1', 'post-2'],
        'viewer-1',
      );

      expect(result.get('post-1')).toEqual({
        likesCount: 3,
        isLikedByMe: true,
      });
      expect(result.get('post-2')).toEqual({
        likesCount: 0,
        isLikedByMe: false,
      });
    });

    it('returns null isLikedByMe and never queries per-viewer likes for an anonymous viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.like.groupBy.mockResolvedValue([{ postId: 'post-1', _count: 2 }]);

      const result = await service.getLikeStateForPosts(['post-1'], undefined);

      expect(prisma.like.findMany).not.toHaveBeenCalled();
      expect(result.get('post-1')).toEqual({
        likesCount: 2,
        isLikedByMe: null,
      });
    });

    it('defaults to a zero likesCount for a post with no like rows at all', async () => {
      const { service, prisma } = createDeps();
      prisma.like.groupBy.mockResolvedValue([]);

      const result = await service.getLikeStateForPosts(['post-1'], undefined);

      expect(result.get('post-1')).toEqual({
        likesCount: 0,
        isLikedByMe: null,
      });
    });
  });

  describe('getLikers', () => {
    it('returns a page of likers with resolved isFollowedByMe', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.like.findMany.mockResolvedValue([
        {
          userId: 'user-2',
          postId: 'post-1',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          user: fakeLiker,
        },
      ]);
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'user-2' }]);

      const result = await service.getLikers('post-1', 'viewer-1', {
        limit: 20,
      });

      expect(result.data).toEqual([
        {
          id: 'user-2',
          username: 'bob',
          fullName: 'Bob Builder',
          avatarUrl: null,
          isFollowedByMe: true,
        },
      ]);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('returns null isFollowedByMe for an anonymous viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.like.findMany.mockResolvedValue([
        {
          userId: 'user-2',
          postId: 'post-1',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          user: fakeLiker,
        },
      ]);

      const result = await service.getLikers('post-1', undefined, {
        limit: 20,
      });

      expect(prisma.follow.findMany).not.toHaveBeenCalled();
      expect(result.data[0].isFollowedByMe).toBeNull();
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      const row = (n: number) => ({
        userId: `user-${n}`,
        postId: 'post-1',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: { ...fakeLiker, id: `user-${n}` },
      });
      prisma.like.findMany.mockResolvedValue([row(1), row(2), row(3)]);

      const result = await service.getLikers('post-1', undefined, {
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('throws NotFoundException for a missing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(
        service.getLikers('missing', undefined, { limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await expect(
        service.getLikers('post-1', undefined, {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.like.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'user-9',
      });

      await service.getLikers('post-1', undefined, { cursor, limit: 20 });

      expect(prisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            postId: 'post-1',
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                userId: { lt: 'user-9' },
              },
            ],
          },
        }),
      );
    });
  });
});
