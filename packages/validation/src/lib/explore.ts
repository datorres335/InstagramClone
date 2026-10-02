import { z } from 'zod';

import { postResponseSchema } from './post';

/**
 * `GET /explore` (docs/API.md §11, docs/FEATURES.md #15, Milestone 18) —
 * full `PostResponse` items, the same choice `GET /feed` (Milestone 12) and
 * `GET /me/saved` (Milestone 15) both made — a grid still needs to render
 * real post cards once tapped. A distinctly-named type rather than
 * literally reusing `FeedResponse` — the wrapper shape is structurally
 * identical, but a feed (posts from who you follow) and explore (posts
 * from who you don't, ranked by engagement) are different concepts with
 * different population and ranking rules, the same "different kind of
 * list despite an identical shape" judgment Milestone 15 made for
 * `SavedPostsResponse` rather than Milestone 13's likers-list reuse.
 */
export const exploreResponseSchema = z.object({
  data: z.array(postResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type ExploreResponse = z.infer<typeof exploreResponseSchema>;
