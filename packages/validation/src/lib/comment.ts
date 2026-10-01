import { z } from 'zod';

import { postAuthorSchema } from './post';

/**
 * `POST /posts/:postId/comments` (docs/API.md §9) — flat comments only; the
 * MVP never accepts `parentCommentId` from the client even though the
 * column exists (`docs/DATABASE.md` §3.8, `docs/FEATURES.md` #12). Same
 * 2200-char cap as `Post.caption`.
 */
export const createCommentInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2200, 'Comment must be at most 2200 characters'),
});
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

/** A single comment (docs/API.md §9) — reuses `postAuthorSchema`, the identical minimal author shape a post response already embeds. */
export const commentResponseSchema = z.object({
  id: z.uuid(),
  author: postAuthorSchema,
  body: z.string(),
  createdAt: z.iso.datetime(),
});
export type CommentResponse = z.infer<typeof commentResponseSchema>;

/** `GET /posts/:postId/comments` (docs/API.md §9) — cursor-paginated, oldest-first (the one paginated list in this codebase that isn't newest-first). */
export const commentListResponseSchema = z.object({
  data: z.array(commentResponseSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export type CommentListResponse = z.infer<typeof commentListResponseSchema>;
