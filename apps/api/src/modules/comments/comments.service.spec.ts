import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { CommentsService } from './comments.service';

const fakeAuthor = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarMedia: null,
};

function fakeCommentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'user-2',
    body: 'Nice!',
    parentCommentId: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
    author: fakeAuthor,
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    post: { findFirst: jest.fn() },
    comment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const storage = {
    getPublicUrl: jest.fn((key: string) => `http://minio.test/${key}`),
  };
  const service = new CommentsService(prisma as never, storage as never);
  return { service, prisma, storage };
}

describe('CommentsService', () => {
  describe('createComment', () => {
    it('creates a comment on an existing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.comment.create.mockResolvedValue(fakeCommentRow());

      const result = await service.createComment('user-2', 'post-1', {
        body: 'Nice!',
      });

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: { postId: 'post-1', authorId: 'user-2', body: 'Nice!' },
        include: { author: { include: { avatarMedia: true } } },
      });
      expect(result.id).toBe('comment-1');
      expect(result.author.username).toBe('bob');
    });

    it('throws NotFoundException for a missing or soft-deleted post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(
        service.createComment('user-2', 'missing', { body: 'Nice!' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });
  });

  describe('getComments', () => {
    it('returns a page of comments oldest-first', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.comment.findMany.mockResolvedValue([fakeCommentRow()]);

      const result = await service.getComments('post-1', { limit: 20 });

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId: 'post-1', deletedAt: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result.data).toEqual([
        {
          id: 'comment-1',
          author: {
            id: 'user-2',
            username: 'bob',
            fullName: 'Bob Builder',
            avatarUrl: null,
          },
          body: 'Nice!',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.comment.findMany.mockResolvedValue([
        fakeCommentRow({ id: 'comment-1' }),
        fakeCommentRow({ id: 'comment-2' }),
        fakeCommentRow({ id: 'comment-3' }),
      ]);

      const result = await service.getComments('post-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('throws NotFoundException for a missing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(
        service.getComments('missing', { limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });

      await expect(
        service.getComments('post-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor with a "greater than" keyset filter (oldest-first)', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.comment.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'comment-0',
      });

      await service.getComments('post-1', { cursor, limit: 20 });

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            postId: 'post-1',
            deletedAt: null,
            OR: [
              { createdAt: { gt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                id: { gt: 'comment-0' },
              },
            ],
          },
        }),
      );
    });
  });

  describe('deleteComment', () => {
    it('soft-deletes when the caller is the comment author', async () => {
      const { service, prisma } = createDeps();
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-2',
        post: { authorId: 'user-1' },
      });

      await service.deleteComment('comment-1', 'user-2');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("soft-deletes when the caller is the post's author moderating someone else's comment", async () => {
      const { service, prisma } = createDeps();
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-2',
        post: { authorId: 'user-1' },
      });

      await service.deleteComment('comment-1', 'user-1');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejects a third party (neither the comment author nor the post author) with ForbiddenException', async () => {
      const { service, prisma } = createDeps();
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-2',
        post: { authorId: 'user-1' },
      });

      await expect(
        service.deleteComment('comment-1', 'user-3'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing or already-deleted comment', async () => {
      const { service, prisma } = createDeps();
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteComment('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getCommentCountForPosts', () => {
    it('returns an empty map without querying for an empty postIds array', async () => {
      const { service, prisma } = createDeps();

      const result = await service.getCommentCountForPosts([]);

      expect(result.size).toBe(0);
      expect(prisma.comment.groupBy).not.toHaveBeenCalled();
    });

    it('computes real counts, defaulting to 0 for a post with no comments', async () => {
      const { service, prisma } = createDeps();
      prisma.comment.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: 4 },
      ]);

      const result = await service.getCommentCountForPosts([
        'post-1',
        'post-2',
      ]);

      expect(prisma.comment.groupBy).toHaveBeenCalledWith({
        by: ['postId'],
        where: { postId: { in: ['post-1', 'post-2'] }, deletedAt: null },
        _count: true,
      });
      expect(result.get('post-1')).toBe(4);
      expect(result.get('post-2')).toBe(0);
    });
  });
});
