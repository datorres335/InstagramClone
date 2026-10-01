import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import type { NotificationJob } from './notifications.service';

/**
 * Runs in-process within `apps/api`, the same accepted MVP trade-off
 * `MediaProcessor` already makes (docs/ARCHITECTURE.md §5.2/§8, risk #4) —
 * registered inside `NotificationsModule` itself since nothing else needs
 * this queue. Deliberately does no existence check on `recipientId`/
 * `actorId`/`postId`/`commentId` before writing — unlike every other
 * domain service's `findActivePost`-style duplication, the producer side
 * (`LikesService`/`CommentsService`/`FollowsService`) has already
 * confirmed every id is real by the time a job is enqueued, so a second
 * check here would be genuinely redundant, not just a different flavor of
 * the same trade-off those services make.
 */
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const { recipientId, actorId, type, postId, commentId } = job.data;
    await this.prisma.notification.create({
      data: { recipientId, actorId, type, postId, commentId },
    });
  }
}
