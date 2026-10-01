import type { Job } from 'bullmq';

import { NotificationsProcessor } from './notifications.processor';
import type { NotificationJob } from './notifications.service';

function createDeps() {
  const prisma = {
    notification: { create: jest.fn() },
  };
  const processor = new NotificationsProcessor(prisma as never);
  return { processor, prisma };
}

describe('NotificationsProcessor', () => {
  it('creates a real notification row from the job data', async () => {
    const { processor, prisma } = createDeps();
    const job = {
      data: {
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
      },
    } as Job<NotificationJob>;

    await processor.process(job);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
        commentId: undefined,
      },
    });
  });
});
