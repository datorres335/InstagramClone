import { z } from 'zod';

/**
 * The `?cursor=<opaque>&limit=<n>` query shape every paginated list endpoint
 * shares (`docs/API.md` §1) — first used by `GET /users/:username/posts`
 * (Milestone 8), reused by every later paginated endpoint (feed, comments,
 * followers/following lists, ...) rather than redeclared per endpoint.
 * `limit` defaults to 20, capped at 50, matching `docs/API.md` §1 exactly.
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
