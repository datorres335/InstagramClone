import { z } from 'zod';

import { postAuthorSchema, postSummarySchema } from './post';

/** Mirrors `prisma/schema.prisma`'s `NotificationType` enum (docs/DATABASE.md §3.10). */
export const notificationTypeSchema = z.enum(['FOLLOW', 'LIKE', 'COMMENT']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * `GET /notifications` (docs/API.md §12) — `actor` reuses `postAuthorSchema`
 * (its third real consumer, after `PostResponse.author`/
 * `CommentResponse.author`), `post` reuses `postSummarySchema` verbatim (the
 * same minimal grid-tile shape is enough to link to and preview the related
 * post). `post`/`comment` are both nullable: a `FOLLOW` notification has
 * neither, a `LIKE` has only `post`, a `COMMENT` has both.
 */
export const notificationResponseSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  actor: postAuthorSchema,
  post: postSummarySchema.nullable(),
  comment: z.object({ id: z.uuid(), body: z.string() }).nullable(),
  isRead: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

/** `GET /notifications` list shape — cursor-paginated, newest-first, the standard convention every list but comments uses. */
export const notificationListResponseSchema = z.object({
  data: z.array(notificationResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

/** `GET /notifications/unread-count` (docs/API.md §12) — the badge-count endpoint. */
export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

/** `POST /notifications/mark-read` (docs/API.md §12) — omit `notificationIds` to mark all as read. */
export const markReadInputSchema = z.object({
  notificationIds: z.array(z.uuid()).optional(),
});
export type MarkReadInput = z.infer<typeof markReadInputSchema>;
