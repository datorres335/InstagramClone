import type { Job } from 'bullmq';

import { NotificationsProcessor } from './notifications.processor';
import type { NotificationJob } from './notifications.service';

const fakeActor = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarMedia: null,
};

function createDeps() {
  const prisma = {
    notification: { create: jest.fn() },
  };
  const storage = {};
  const eventsService = { emit: jest.fn() };
  const processor = new NotificationsProcessor(
    prisma as never,
    storage as never,
    eventsService as never,
  );
  return { processor, prisma, eventsService };
}

describe('NotificationsProcessor', () => {
  it('creates a real notification row from the job data', async () => {
    const { processor, prisma } = createDeps();
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      type: 'LIKE',
      actor: fakeActor,
      post: null,
      comment: null,
      isRead: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const job = {
      data: {
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
      },
    } as Job<NotificationJob>;

    await processor.process(job);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          recipientId: 'user-1',
          actorId: 'user-2',
          type: 'LIKE',
          postId: 'post-1',
          commentId: undefined,
        },
      }),
    );
  });

  it('pushes a notification event to the recipient after the row is created', async () => {
    const { processor, prisma, eventsService } = createDeps();
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      type: 'LIKE',
      actor: fakeActor,
      post: null,
      comment: null,
      isRead: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const job = {
      data: { recipientId: 'user-1', actorId: 'user-2', type: 'LIKE' },
    } as Job<NotificationJob>;

    await processor.process(job);

    expect(eventsService.emit).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        type: 'notification',
        notification: expect.objectContaining({ id: 'notif-1', type: 'LIKE' }),
      }),
    );
  });
});
