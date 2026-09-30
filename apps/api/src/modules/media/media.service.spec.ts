import {
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { MediaService } from './media.service';
import { MediaNotReadyException } from './media.exceptions';

const fakePendingMedia = {
  id: 'media-1',
  ownerId: 'user-1',
  purpose: 'AVATAR' as const,
  status: 'PENDING' as const,
  storageKey: 'media/media-1/original',
  variants: null,
  width: null,
  height: null,
  blurhash: null,
  byteSize: 1024,
  contentType: 'image/png',
  failureReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createDeps() {
  const prisma = {
    media: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };
  const storage = {
    getPresignedUploadUrl: jest.fn(),
    objectExists: jest.fn(),
    getObjectBuffer: jest.fn(),
    putObject: jest.fn(),
    getPublicUrl: jest.fn((key: string) => `http://minio.test/${key}`),
  };
  const mediaQueue = { add: jest.fn() };

  const service = new MediaService(
    prisma as never,
    storage as never,
    mediaQueue as never,
  );
  return { service, prisma, storage, mediaQueue };
}

describe('MediaService', () => {
  describe('presign', () => {
    it('creates a PENDING media row, fills in the storage key, and returns a presigned upload URL', async () => {
      const { service, prisma, storage } = createDeps();
      prisma.media.create.mockResolvedValue({
        ...fakePendingMedia,
        storageKey: '',
      });
      prisma.media.update.mockResolvedValue(fakePendingMedia);
      storage.getPresignedUploadUrl.mockResolvedValue(
        'http://minio.test/presigned',
      );

      const result = await service.presign('user-1', {
        purpose: 'AVATAR',
        contentType: 'image/png',
        byteSize: 1024,
      });

      expect(prisma.media.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'user-1',
          purpose: 'AVATAR',
          byteSize: 1024,
          contentType: 'image/png',
          storageKey: '',
        },
      });
      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { storageKey: 'media/media-1/original' },
      });
      expect(storage.getPresignedUploadUrl).toHaveBeenCalledWith(
        'media/media-1/original',
        'image/png',
        300,
      );
      expect(result.mediaId).toBe('media-1');
      expect(result.uploadUrl).toBe('http://minio.test/presigned');
    });

    it('rejects an oversized upload with PayloadTooLargeException before touching the database', async () => {
      const { service, prisma } = createDeps();

      await expect(
        service.presign('user-1', {
          purpose: 'AVATAR',
          contentType: 'image/png',
          byteSize: 9 * 1024 * 1024,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      expect(prisma.media.create).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('enqueues a processing job when the object has been uploaded', async () => {
      const { service, prisma, storage, mediaQueue } = createDeps();
      prisma.media.findUnique.mockResolvedValue(fakePendingMedia);
      storage.objectExists.mockResolvedValue(true);

      await service.complete('user-1', 'media-1');

      expect(storage.objectExists).toHaveBeenCalledWith(
        fakePendingMedia.storageKey,
      );
      expect(mediaQueue.add).toHaveBeenCalledWith('process', {
        mediaId: 'media-1',
      });
    });

    it('throws NotFoundException when the object was never actually uploaded', async () => {
      const { service, prisma, storage, mediaQueue } = createDeps();
      prisma.media.findUnique.mockResolvedValue(fakePendingMedia);
      storage.objectExists.mockResolvedValue(false);

      await expect(
        service.complete('user-1', 'media-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mediaQueue.add).not.toHaveBeenCalled();
    });

    it('is idempotent: an already-processed media is not re-enqueued', async () => {
      const { service, prisma, storage, mediaQueue } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        status: 'READY',
      });

      await service.complete('user-1', 'media-1');

      expect(storage.objectExists).not.toHaveBeenCalled();
      expect(mediaQueue.add).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException for another user's media", async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue(fakePendingMedia);

      await expect(
        service.complete('someone-else', 'media-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a media id that does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue(null);

      await expect(
        service.complete('user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getById', () => {
    it('returns the resolved media response for the owner', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        status: 'READY',
        variants: {
          thumbnail: 'media-1/thumbnail.webp',
          feed: 'media-1/feed.webp',
        },
      });

      const result = await service.getById('user-1', 'media-1');

      expect(result.variants).toEqual({
        thumbnail: 'http://minio.test/media-1/thumbnail.webp',
        feed: 'http://minio.test/media-1/feed.webp',
      });
    });
  });

  describe('setAsAvatar', () => {
    it("sets User.avatarMediaId when the media is the caller's own, READY, AVATAR-purpose media", async () => {
      const { service, prisma } = createDeps();
      const readyAvatar = {
        ...fakePendingMedia,
        status: 'READY' as const,
        variants: {
          thumbnail: 'media-1/thumbnail.webp',
          feed: 'media-1/feed.webp',
        },
      };
      prisma.media.findUnique.mockResolvedValue(readyAvatar);

      await service.setAsAvatar('user-1', 'media-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarMediaId: 'media-1' },
      });
    });

    it('rejects a still-PENDING media with MediaNotReadyException', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue(fakePendingMedia);

      await expect(
        service.setAsAvatar('user-1', 'media-1'),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a FAILED media with MediaNotReadyException', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        status: 'FAILED',
        failureReason: 'sharp blew up',
      });

      await expect(
        service.setAsAvatar('user-1', 'media-1'),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
    });

    it('rejects a READY media whose purpose is POST_IMAGE, not AVATAR', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        purpose: 'POST_IMAGE',
        status: 'READY',
        variants: { thumbnail: 'k', feed: 'k' },
      });

      await expect(
        service.setAsAvatar('user-1', 'media-1'),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
    });
  });

  describe('getReadyMediaForAttachment', () => {
    it("returns the media when it's the caller's own, READY, and the expected purpose", async () => {
      const { service, prisma } = createDeps();
      const readyPostImage = {
        ...fakePendingMedia,
        purpose: 'POST_IMAGE' as const,
        status: 'READY' as const,
      };
      prisma.media.findUnique.mockResolvedValue(readyPostImage);

      const result = await service.getReadyMediaForAttachment(
        'user-1',
        'media-1',
        'POST_IMAGE',
      );

      expect(result).toEqual(readyPostImage);
    });

    it('rejects the wrong purpose with MediaNotReadyException', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        purpose: 'AVATAR',
        status: 'READY',
      });

      await expect(
        service.getReadyMediaForAttachment('user-1', 'media-1', 'POST_IMAGE'),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
    });

    it('rejects a non-READY media with MediaNotReadyException', async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        purpose: 'POST_IMAGE',
        status: 'PENDING',
      });

      await expect(
        service.getReadyMediaForAttachment('user-1', 'media-1', 'POST_IMAGE'),
      ).rejects.toBeInstanceOf(MediaNotReadyException);
    });

    it("rejects another user's media with ForbiddenException", async () => {
      const { service, prisma } = createDeps();
      prisma.media.findUnique.mockResolvedValue({
        ...fakePendingMedia,
        purpose: 'POST_IMAGE',
        status: 'READY',
      });

      await expect(
        service.getReadyMediaForAttachment(
          'someone-else',
          'media-1',
          'POST_IMAGE',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('resolveAvatarUrl', () => {
    it('returns null for a null media', () => {
      const { service } = createDeps();
      expect(service.resolveAvatarUrl(null)).toBeNull();
    });

    it("returns the thumbnail variant's public URL for a READY media", () => {
      const { service } = createDeps();
      const result = service.resolveAvatarUrl({
        ...fakePendingMedia,
        status: 'READY',
        variants: {
          thumbnail: 'media-1/thumbnail.webp',
          feed: 'media-1/feed.webp',
        },
      } as never);
      expect(result).toBe('http://minio.test/media-1/thumbnail.webp');
    });
  });
});
