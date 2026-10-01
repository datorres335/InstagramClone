import type {
  Comment,
  Media,
  Notification,
  Post,
  PostMedia,
  User,
} from '@instagram-clone/prisma-client';
import type { NotificationResponse } from '@instagram-clone/validation';

import {
  resolveAvatarUrl,
  resolveVariantUrls,
} from '../media/media-response.mapper';
import type { StorageService } from '../../storage/storage.service';

/**
 * The join shape `NotificationsService.getNotifications`'s `include`
 * produces — inlined at the Prisma call site rather than shared (the
 * Milestone 11 inline-`include`-vs-shared-constant lesson,
 * `apps/api/src/modules/posts/post-response.mapper.ts`). `actor` is
 * required here, not the schema's nullable `User | null` — every
 * notification this MVP's producers create always has one (`actorId`
 * nullable only for a future system-notification type this codebase
 * doesn't implement yet, docs/DATABASE.md §3.10); rows with a null actor
 * are filtered out in the service before reaching this mapper rather than
 * handled here.
 */
export type NotificationWithRelations = Notification & {
  actor: User & { avatarMedia: Media | null };
  post: (Post & { media: (PostMedia & { media: Media })[] }) | null;
  comment: Pick<Comment, 'id' | 'body'> | null;
};

export function toNotificationResponse(
  notification: NotificationWithRelations,
  storage: StorageService,
): NotificationResponse {
  const cover = notification.post?.media[0];
  const coverVariants = cover ? resolveVariantUrls(cover.media, storage) : null;

  return {
    id: notification.id,
    type: notification.type,
    actor: {
      id: notification.actor.id,
      username: notification.actor.username,
      fullName: notification.actor.fullName,
      avatarUrl: resolveAvatarUrl(notification.actor.avatarMedia, storage),
    },
    post: notification.post
      ? {
          id: notification.post.id,
          thumbnailUrl: coverVariants?.thumbnail ?? null,
          createdAt: notification.post.createdAt.toISOString(),
        }
      : null,
    comment: notification.comment,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
