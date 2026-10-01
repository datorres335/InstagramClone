import type {
  NotificationListResponse,
  PaginationQuery,
  UnreadCountResponse,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface NotificationsClient {
  /**
   * `GET /notifications` (docs/API.md §12, Milestone 16) — the caller's own
   * notifications, newest first. `Partial`, not `PaginationQuery`, matching
   * `PostsClient.getFeed`'s reasoning: a "load more" affordance only ever
   * has a `cursor` in hand.
   */
  list(query?: Partial<PaginationQuery>): Promise<NotificationListResponse>;
  /** `GET /notifications/unread-count` (docs/API.md §12) — the badge-count endpoint, meant to be polled. */
  getUnreadCount(): Promise<UnreadCountResponse>;
  /** `POST /notifications/mark-read` (docs/API.md §12) — omit `notificationIds` to mark all as read. */
  markRead(notificationIds?: string[]): Promise<void>;
}

export function createNotificationsClient(
  http: HttpClient,
): NotificationsClient {
  return {
    list(query) {
      return http.authorizedRequest<NotificationListResponse>(
        'GET',
        `/notifications${buildQueryString(query)}`,
      );
    },

    getUnreadCount() {
      return http.authorizedRequest<UnreadCountResponse>(
        'GET',
        '/notifications/unread-count',
      );
    },

    markRead(notificationIds) {
      return http.authorizedRequest<void, { notificationIds?: string[] }>(
        'POST',
        '/notifications/mark-read',
        notificationIds ? { notificationIds } : {},
      );
    },
  };
}
