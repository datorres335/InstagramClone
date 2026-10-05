import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { EventsService } from '../events/events.service';
import {
  toNotificationResponse,
  type NotificationWithRelations,
} from './notification-response.mapper';
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
 *
 * Also the realtime push point for `notification` events (Milestone 22):
 * emitted after the row is actually written, with the same relations
 * `NotificationsService.getNotifications` includes, so the pushed payload
 * is a real `NotificationResponse` rather than a parallel "live" shape.
 */
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly eventsService: EventsService,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const { recipientId, actorId, type, postId, commentId } = job.data;
    const notification = await this.prisma.notification.create({
      data: { recipientId, actorId, type, postId, commentId },
      include: {
        actor: { include: { avatarMedia: true } },
        post: {
          include: {
            media: { where: { position: 0 }, include: { media: true } },
          },
        },
        comment: { select: { id: true, body: true } },
      },
    });

    this.eventsService.emit(recipientId, {
      type: 'notification',
      notification: toNotificationResponse(
        notification as NotificationWithRelations,
        this.storage,
      ),
    });
  }
}
