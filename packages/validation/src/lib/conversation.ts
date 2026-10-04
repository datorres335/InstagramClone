import { z } from 'zod';

import { postAuthorSchema } from './post';
import { usernameSchema } from './user';

/**
 * `POST /conversations` (docs/API.md §17, Milestone 21) — starts (or returns
 * the existing) 1:1 conversation with `username`, mirroring `Follow`'s own
 * username-targeted-by-path convention closely enough in spirit, but this
 * one needs a body since there's no `/users/:username/...` nesting here.
 */
export const startConversationInputSchema = z.object({
  username: usernameSchema,
});
export type StartConversationInput = z.infer<
  typeof startConversationInputSchema
>;

/**
 * `POST /conversations/:id/messages` (docs/API.md §17) — same 2200-char cap
 * as `Comment.body`/`Post.caption`.
 */
export const createMessageInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2200, 'Message must be at most 2200 characters'),
});
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

/** A single message (docs/API.md §17) — `sender` reuses `postAuthorSchema`, the same minimal author shape every other response embeds. */
export const messageResponseSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  sender: postAuthorSchema,
  body: z.string(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type MessageResponse = z.infer<typeof messageResponseSchema>;

/**
 * `GET /conversations/:id/messages` (docs/API.md §17) — cursor-paginated
 * newest-first at the query level (matching `GET /feed`/`GET
 * /notifications`, not `GET /posts/:postId/comments`'s oldest-first
 * convention — a chat thread needs to open on recent activity). `data`
 * itself is in chronological order within the page, ready to render top-
 * to-bottom.
 */
export const messageListResponseSchema = z.object({
  data: z.array(messageResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;

/**
 * `POST /conversations`, `GET /conversations` (docs/API.md §17) — `otherParticipants`
 * excludes the caller (the only useful rendering of a 1:1 conversation is
 * "who's the other person"), plural and an array so this shape doesn't need
 * to change if group chat is ever added. `lastMessage` is nullable only in
 * principle (a conversation always gets its first message atomically with
 * creation in this MVP) but modeled nullable since the schema doesn't
 * enforce that invariant. `unreadCount` is this conversation's count of the
 * caller's unread messages, the same per-item badge role
 * `NotificationResponse.isRead` plays, just pre-aggregated here since a
 * conversation can have many unread messages at once.
 */
export const conversationResponseSchema = z.object({
  id: z.uuid(),
  otherParticipants: z.array(postAuthorSchema),
  lastMessage: messageResponseSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

/** `GET /conversations` (docs/API.md §17) — cursor-paginated by `(lastMessageAt, id)`, newest-activity-first. */
export const conversationListResponseSchema = z.object({
  data: z.array(conversationResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type ConversationListResponse = z.infer<
  typeof conversationListResponseSchema
>;
