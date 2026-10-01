import { BadRequestException } from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { NotificationsService } from './notifications.service';

const fakeActor = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarMedia: null,
};

function fakeNotificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    recipientId: 'user-1',
    actorId: 'user-2',
    type: 'FOLLOW',
    postId: null,
    commentId: null,
    isRead: false,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    actor: fakeActor,
    post: null,
    comment: null,
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storage = {
    getPublicUrl: jest.fn((key: string) => `http://minio.test/${key}`),
  };
  const notificationsQueue = { add: jest.fn() };
  const service = new NotificationsService(
    prisma as never,
    storage as never,
    notificationsQueue as never,
  );
  return { service, prisma, storage, notificationsQueue };
}

describe('NotificationsService', () => {
  describe('enqueueNotification', () => {
    it('enqueues a job for a normal actor/recipient pair', async () => {
      const { service, notificationsQueue } = createDeps();

      await service.enqueueNotification({
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
      });

      expect(notificationsQueue.add).toHaveBeenCalledWith('create', {
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
      });
    });

    it('never enqueues a self-notification', async () => {
      const { service, notificationsQueue } = createDeps();

      await service.enqueueNotification({
        recipientId: 'user-1',
        actorId: 'user-1',
        type: 'LIKE',
        postId: 'post-1',
      });

      expect(notificationsQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('returns a page of notifications newest-first', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([fakeNotificationRow()]);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'user-1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(result.data).toEqual([
        {
          id: 'notif-1',
          type: 'FOLLOW',
          actor: {
            id: 'user-2',
            username: 'bob',
            fullName: 'Bob Builder',
            avatarUrl: null,
          },
          post: null,
          comment: null,
          isRead: false,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('filters out any row with a null actor rather than crashing the mapper', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([
        fakeNotificationRow({ actor: null }),
        fakeNotificationRow({ id: 'notif-2' }),
      ]);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('notif-2');
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([
        fakeNotificationRow({ id: 'notif-1' }),
        fakeNotificationRow({ id: 'notif-2' }),
        fakeNotificationRow({ id: 'notif-3' }),
      ]);

      const result = await service.getNotifications('user-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service } = createDeps();

      await expect(
        service.getNotifications('user-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the decoded cursor as a keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'notif-9',
      });

      await service.getNotifications('user-1', { cursor, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: 'user-1',
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                id: { lt: 'notif-9' },
              },
            ],
          },
        }),
      );
    });

    it('maps a LIKE notification with a post summary', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([
        fakeNotificationRow({
          type: 'LIKE',
          postId: 'post-1',
          post: {
            id: 'post-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            media: [],
          },
        }),
      ]);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(result.data[0].post).toEqual({
        id: 'post-1',
        thumbnailUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('maps a COMMENT notification with both a post and a comment summary', async () => {
      const { service, prisma } = createDeps();
      prisma.notification.findMany.mockResolvedValue([
        fakeNotificationRow({
          type: 'COMMENT',
          postId: 'post-1',
          commentId: 'comment-1',
          post: {
            id: 'post-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            media: [],
          },
          comment: { id: 'comment-1', body: 'Nice!' },
        }),
      ]);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(result.data[0].comment).toEqual({
        id: 'comment-1',
        body: 'Nice!',
      });
    });
  });

  describe('getUnreadCount', () => {
    it("counts only this recipient's unread notifications", async () => {
      const { service, prisma } = createDeps();
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'user-1', isRead: false },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markRead', () => {
    it("marks all of the recipient's notifications as read when no ids are given", async () => {
      const { service, prisma } = createDeps();

      await service.markRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-1' },
        data: { isRead: true },
      });
    });

    it('scopes to the given ids, always also scoped by recipientId', async () => {
      const { service, prisma } = createDeps();

      await service.markRead('user-1', ['notif-1', 'notif-2']);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user-1',
          id: { in: ['notif-1', 'notif-2'] },
        },
        data: { isRead: true },
      });
    });
  });
});
