import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import type { NotificationType } from '@instagram-clone/prisma-client';
import type {
  NotificationListResponse,
  PaginationQuery,
  UnreadCountResponse,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import {
  toNotificationResponse,
  type NotificationWithRelations,
} from './notification-response.mapper';

export interface NotificationJob {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue<NotificationJob>,
  ) {}

  /**
   * The producer side of the pipeline (docs/ARCHITECTURE.md risk #10,
   * docs/FEATURES.md #16) — called by `LikesService.like`,
   * `CommentsService.createComment`, and `FollowsService.follow` after
   * their own action succeeds. Never writes synchronously; always enqueues
   * a job for `NotificationsProcessor` to turn into a real row. Guards
   * against self-notification centrally (a single source of truth, rather
   * than trusting every producer to remember it) — liking/commenting on
   * your own post, or the impossible-anyway self-follow case, never
   * notifies anyone.
   */
  async enqueueNotification(input: NotificationJob): Promise<void> {
    if (input.recipientId === input.actorId) return;
    await this.notificationsQueue.add('create', input);
  }

  /** `GET /notifications` (docs/API.md §12) — newest-first, the standard convention every list but comments uses. */
  async getNotifications(
    userId: string,
    query: PaginationQuery,
  ): Promise<NotificationListResponse> {
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
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

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    // Every notification this codebase's producers create has a real actor
    // (see notification-response.mapper.ts's doc comment) — filtering here
    // rather than trusting the type is what lets the mapper itself treat
    // `actor` as required instead of threading a null-check through it.
    const data = page
      .filter((row) => row.actor !== null)
      .map((row) =>
        toNotificationResponse(row as NotificationWithRelations, this.storage),
      );

    return { data, meta: { nextCursor } };
  }

  /** `GET /notifications/unread-count` (docs/API.md §12) — the badge-count endpoint. */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  /**
   * `POST /notifications/mark-read` (docs/API.md §12) — omitting
   * `notificationIds` marks all of the caller's notifications as read.
   * Always scoped by `recipientId: userId`, never trusting the client-
   * supplied ids alone — a caller can't mark someone else's notification
   * as read just by guessing its id.
   */
  async markRead(userId: string, notificationIds?: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        ...(notificationIds ? { id: { in: notificationIds } } : {}),
      },
      data: { isRead: true },
    });
  }

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }
}
