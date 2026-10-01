import { z } from 'zod';

import { postResponseSchema } from './post';

/**
 * `GET /me/saved` (docs/API.md §10, Milestone 15) — full `PostResponse`
 * items, the same choice `GET /feed` made (Milestone 12): `docs/FEATURES.md`
 * #13's "view your saved posts in a dedicated list" reads like a real
 * post-rendering surface, not a thumbnail grid. A distinctly-named type
 * rather than literally reusing `FeedResponse` — the wrapper shape is
 * identical, but a saved-posts list and a feed are different concepts, and
 * naming the type after what it represents keeps call sites self-documenting
 * even though the underlying schema is structurally the same as `feedResponseSchema`.
 */
export const savedPostsResponseSchema = z.object({
  data: z.array(postResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type SavedPostsResponse = z.infer<typeof savedPostsResponseSchema>;
