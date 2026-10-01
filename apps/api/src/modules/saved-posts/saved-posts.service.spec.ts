import { BadRequestException, NotFoundException } from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { SavedPostsService } from './saved-posts.service';

function createDeps() {
  const prisma = {
    post: { findFirst: jest.fn() },
    savedPost: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const service = new SavedPostsService(prisma as never);
  return { service, prisma };
}

describe('SavedPostsService', () => {
  describe('save', () => {
    it('upserts the saved post, idempotent by construction', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await service.save('user-1', 'post-1');

      expect(prisma.savedPost.upsert).toHaveBeenCalledWith({
        where: { userId_postId: { userId: 'user-1', postId: 'post-1' } },
        create: { userId: 'user-1', postId: 'post-1' },
        update: {},
      });
    });

    it('throws NotFoundException for a missing or soft-deleted post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.save('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.savedPost.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unsave', () => {
    it('deletes the saved post, idempotent whether or not it existed', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await service.unsave('user-1', 'post-1');

      expect(prisma.savedPost.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', postId: 'post-1' },
      });
    });

    it('throws NotFoundException for a missing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.unsave('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getSavedStateForPosts', () => {
    it('returns an empty map without querying for an empty postIds array', async () => {
      const { service, prisma } = createDeps();

      const result = await service.getSavedStateForPosts([], 'user-1');

      expect(result.size).toBe(0);
      expect(prisma.savedPost.findMany).not.toHaveBeenCalled();
    });

    it('returns null for every post, without querying, for an anonymous viewer', async () => {
      const { service, prisma } = createDeps();

      const result = await service.getSavedStateForPosts(
        ['post-1', 'post-2'],
        undefined,
      );

      expect(prisma.savedPost.findMany).not.toHaveBeenCalled();
      expect(result.get('post-1')).toBeNull();
      expect(result.get('post-2')).toBeNull();
    });

    it('computes real true/false per post for an authenticated viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.savedPost.findMany.mockResolvedValue([{ postId: 'post-1' }]);

      const result = await service.getSavedStateForPosts(
        ['post-1', 'post-2'],
        'viewer-1',
      );

      expect(prisma.savedPost.findMany).toHaveBeenCalledWith({
        where: { userId: 'viewer-1', postId: { in: ['post-1', 'post-2'] } },
        select: { postId: true },
      });
      expect(result.get('post-1')).toBe(true);
      expect(result.get('post-2')).toBe(false);
    });
  });

  describe('getSavedPostIdsForViewer', () => {
    it('returns a page of postIds, newest-first', async () => {
      const { service, prisma } = createDeps();
      prisma.savedPost.findMany.mockResolvedValue([
        { postId: 'post-2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
        { postId: 'post-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ]);

      const result = await service.getSavedPostIdsForViewer('viewer-1', {
        limit: 20,
      });

      expect(prisma.savedPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'viewer-1' },
          orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
        }),
      );
      expect(result.postIds).toEqual(['post-2', 'post-1']);
      expect(result.nextCursor).toBeNull();
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      const row = (n: number) => ({
        postId: `post-${n}`,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      });
      prisma.savedPost.findMany.mockResolvedValue([row(1), row(2), row(3)]);

      const result = await service.getSavedPostIdsForViewer('viewer-1', {
        limit: 2,
      });

      expect(result.postIds).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service } = createDeps();

      await expect(
        service.getSavedPostIdsForViewer('viewer-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.savedPost.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-9',
      });

      await service.getSavedPostIdsForViewer('viewer-1', {
        cursor,
        limit: 20,
      });

      expect(prisma.savedPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'viewer-1',
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                postId: { lt: 'post-9' },
              },
            ],
          },
        }),
      );
    });
  });
});
