import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { MediaNotReadyException } from '../media/media.exceptions';
import { PostsService } from './posts.service';

const fakeReadyMedia = (id: string) => ({
  id,
  ownerId: 'user-1',
  purpose: 'POST_IMAGE' as const,
  status: 'READY' as const,
  storageKey: `media/${id}/original`,
  variants: { thumbnail: `${id}/thumbnail.webp`, feed: `${id}/feed.webp` },
  width: 800,
  height: 600,
  blurhash: 'hash',
  byteSize: 1024,
  contentType: 'image/png',
  failureReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

const fakeAuthor = {
  id: 'user-1',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarMedia: null,
};

function fakePostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    authorId: 'user-1',
    caption: 'Hello',
    location: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
    author: fakeAuthor,
    media: [
      {
        id: 'pm-1',
        postId: 'post-1',
        mediaId: 'media-1',
        position: 0,
        altText: null,
        media: fakeReadyMedia('media-1'),
      },
    ],
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    post: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    postMedia: {
      findFirst: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
  };
  const mediaService = {
    getReadyMediaForAttachment: jest.fn(),
  };
  const storage = {
    getPublicUrl: jest.fn((key: string) => `http://minio.test/${key}`),
  };
  const service = new PostsService(
    prisma as never,
    mediaService as never,
    storage as never,
  );
  return { service, prisma, mediaService, storage };
}

describe('PostsService', () => {
  describe('createPost', () => {
    it('validates every mediaId, checks none are already attached, and creates the post', async () => {
      const { service, prisma, mediaService } = createDeps();
      mediaService.getReadyMediaForAttachment.mockResolvedValue(
        fakeReadyMedia('media-1'),
      );
      prisma.postMedia.findFirst.mockResolvedValue(null);
      prisma.post.create.mockResolvedValue(fakePostRow());

      const result = await service.createPost('user-1', {
        caption: 'Hello',
        mediaIds: ['media-1'],
      });

      expect(mediaService.getReadyMediaForAttachment).toHaveBeenCalledWith(
        'user-1',
        'media-1',
        'POST_IMAGE',
      );
      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: 'user-1',
            caption: 'Hello',
            media: { create: [{ mediaId: 'media-1', position: 0 }] },
          }),
        }),
      );
      expect(result.id).toBe('post-1');
      expect(result.media).toHaveLength(1);
      expect(result.media[0].url).toBe('http://minio.test/media-1/feed.webp');
    });

    it('preserves array order as carousel position', async () => {
      const { service, prisma, mediaService } = createDeps();
      mediaService.getReadyMediaForAttachment.mockResolvedValue(
        fakeReadyMedia('media-x'),
      );
      prisma.postMedia.findFirst.mockResolvedValue(null);
      prisma.post.create.mockResolvedValue(fakePostRow());

      await service.createPost('user-1', {
        mediaIds: ['media-1', 'media-2', 'media-3'],
      });

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            media: {
              create: [
                { mediaId: 'media-1', position: 0 },
                { mediaId: 'media-2', position: 1 },
                { mediaId: 'media-3', position: 2 },
              ],
            },
          }),
        }),
      );
    });

    it('rejects the same mediaId listed twice with ConflictException, before any DB call', async () => {
      const { service, prisma, mediaService } = createDeps();

      await expect(
        service.createPost('user-1', {
          mediaIds: ['media-1', 'media-1'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mediaService.getReadyMediaForAttachment).not.toHaveBeenCalled();
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('rejects media already attached to another post with ConflictException', async () => {
      const { service, prisma, mediaService } = createDeps();
      mediaService.getReadyMediaForAttachment.mockResolvedValue(
        fakeReadyMedia('media-1'),
      );
      prisma.postMedia.findFirst.mockResolvedValue({ id: 'existing-pm' });

      await expect(
        service.createPost('user-1', { mediaIds: ['media-1'] }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('propagates MediaNotReadyException for non-READY or wrong-purpose media', async () => {
      const { service, mediaService } = createDeps();
      mediaService.getReadyMediaForAttachment.mockRejectedValue(
        new MediaNotReadyException('not ready'),
      );

      await expect(
        service.createPost('user-1', { mediaIds: ['media-1'] }),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
    });
  });

  describe('getById', () => {
    it('returns the post with isLikedByMe/isSavedByMe false for an authenticated viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(fakePostRow());

      const result = await service.getById('post-1', 'viewer-1');

      expect(result.isLikedByMe).toBe(false);
      expect(result.isSavedByMe).toBe(false);
    });

    it('returns null isLikedByMe/isSavedByMe for an anonymous viewer', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(fakePostRow());

      const result = await service.getById('post-1', undefined);

      expect(result.isLikedByMe).toBeNull();
      expect(result.isSavedByMe).toBeNull();
    });

    it('throws NotFoundException for a missing or soft-deleted post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(
        service.getById('missing', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.post.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'missing', deletedAt: null },
        }),
      );
    });
  });

  describe('deletePost', () => {
    it('soft-deletes when the caller is the author', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(fakePostRow());

      await service.deletePost('post-1', 'user-1');

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejects a non-author with ForbiddenException', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(fakePostRow());

      await expect(
        service.deletePost('post-1', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.post.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing post', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePost('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPostCountByAuthor', () => {
    it("counts only that author's active (non-deleted) posts", async () => {
      const { service, prisma } = createDeps();
      prisma.post.count.mockResolvedValue(7);

      const result = await service.getPostCountByAuthor('user-1');

      expect(prisma.post.count).toHaveBeenCalledWith({
        where: { authorId: 'user-1', deletedAt: null },
      });
      expect(result).toBe(7);
    });
  });

  describe('getFeed', () => {
    it('returns an empty feed without querying posts when the viewer follows nobody', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findMany.mockResolvedValue([]);

      const result = await service.getFeed('viewer-1', { limit: 20 });

      expect(result).toEqual({ data: [], meta: { nextCursor: null } });
      expect(prisma.post.findMany).not.toHaveBeenCalled();
    });

    it('queries only posts authored by followed accounts', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findMany.mockResolvedValue([
        { followingId: 'author-a' },
        { followingId: 'author-b' },
      ]);
      prisma.post.findMany.mockResolvedValue([fakePostRow()]);

      const result = await service.getFeed('viewer-1', { limit: 20 });

      expect(prisma.follow.findMany).toHaveBeenCalledWith({
        where: { followerId: 'viewer-1' },
        select: { followingId: true },
      });
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: { in: ['author-a', 'author-b'] },
            deletedAt: null,
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('post-1');
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'author-a' }]);
      prisma.post.findMany.mockResolvedValue([
        fakePostRow({ id: 'post-1' }),
        fakePostRow({ id: 'post-2' }),
        fakePostRow({ id: 'post-3' }),
      ]);

      const result = await service.getFeed('viewer-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service, prisma } = createDeps();

      await expect(
        service.getFeed('viewer-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.follow.findMany).not.toHaveBeenCalled();
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'author-a' }]);
      prisma.post.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-9',
      });

      await service.getFeed('viewer-1', { cursor, limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                id: { lt: 'post-9' },
              },
            ],
          }),
        }),
      );
    });
  });

  describe('getPostsByAuthor', () => {
    it('returns a grid page with resolved thumbnail URLs', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          media: [{ media: fakeReadyMedia('media-1') }],
        },
      ]);

      const result = await service.getPostsByAuthor('user-1', { limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { authorId: 'user-1', deletedAt: null },
        }),
      );
      expect(result.data).toEqual([
        {
          id: 'post-1',
          thumbnailUrl: 'http://minio.test/media-1/thumbnail.webp',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      const row = (n: number) => ({
        id: `post-${n}`,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        media: [],
      });
      prisma.post.findMany.mockResolvedValue([row(1), row(2), row(3)]);

      const result = await service.getPostsByAuthor('user-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service } = createDeps();

      await expect(
        service.getPostsByAuthor('user-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.post.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-9',
      });

      await service.getPostsByAuthor('user-1', { cursor, limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: 'user-1',
            deletedAt: null,
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                id: { lt: 'post-9' },
              },
            ],
          },
        }),
      );
    });
  });
});
