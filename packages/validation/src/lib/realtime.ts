import { z } from 'zod';

import { messageResponseSchema } from './conversation';
import { notificationResponseSchema } from './notification';

/**
 * `GET /events` (docs/API.md §18, Milestone 22) — the SSE payload shape, one
 * JSON object per `data:` line. A discriminated union of exactly the two
 * push-worthy things this codebase creates asynchronously via a background
 * job (`docs/ARCHITECTURE.md` risk #10): a new `Notification` row
 * (Milestone 16) and a new `Message` row (Milestone 21) — both already have
 * a real response shape, reused verbatim rather than inventing parallel
 * "live" types. Every other mutation (follow, like, post, ...) already
 * updates the UI synchronously from its own request/response — there is
 * nothing else to push.
 */
export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('notification'), notification: notificationResponseSchema }),
  z.object({ type: z.literal('message'), message: messageResponseSchema }),
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
