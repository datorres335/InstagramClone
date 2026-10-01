import { z } from 'zod';

/**
 * `GET /search/users?q=` (docs/API.md §11, Milestone 17) — deliberately its
 * own schema, not a reuse of `paginationQuerySchema`: there's no `cursor`
 * here. Trigram `similarity()` ranking has no stable, monotonic sort key to
 * build a keyset cursor from the way `createdAt` serves every other list
 * endpoint, and a capped top-N "best matches" page is what every real
 * username-search UI (including Instagram's own) actually needs — see
 * docs/PROGRESS.md's Milestone 17 deviations for the full reasoning.
 */
export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
