import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '@instagram-clone/prisma-client';
import type { PaginationQuery } from '@instagram-clone/validation';

import {
  decodeExploreCursor,
  encodeExploreCursor,
} from '../../common/pagination/explore-cursor';
import { PrismaService } from '../../prisma/prisma.service';

export interface ExplorePostIdsPage {
  postIds: string[];
  nextCursor: string | null;
}

/** "Recent" for Explore ranking purposes (docs/DATABASE.md §6/§10) — a deliberately simple, documented choice; not specified further in the original design. */
const EXPLORE_WINDOW_DAYS = 7;

@Injectable()
export class ExploreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /explore` (docs/API.md §11, docs/DATABASE.md §6) — posts from
   * accounts the viewer doesn't follow (and never the viewer's own posts,
   * the same "who I follow and myself are disjoint" discipline `GET /feed`
   * already applies — not automatic here the way it is for `Follow`'s own
   * self-referential model, so enforced explicitly), from the last
   * `EXPLORE_WINDOW_DAYS` days, ranked by like count within that window
   * (descending), then recency (descending) as a tiebreaker. `docs/DATABASE.md`
   * §10 explicitly sanctions computing this live via an aggregate query
   * rather than a precomputed ranking table at MVP scale.
   *
   * Unlike `SearchService` (Milestone 17), this ranking *does* have a real,
   * stable sort key — `(likesCount, createdAt, id)`, all three monotonic —
   * so a genuine keyset cursor is possible and implemented here via raw SQL
   * (Prisma's query builder can't filter/order by a live-computed aggregate
   * in one query). `PostsService.getExplore` turns the returned ids into
   * full `PostResponse` items, the same split `SavedPostsService
   * .getSavedPostIdsForViewer` / `PostsService.getSavedPosts` already
   * established.
   */
  async getRankedPostIds(
    viewerId: string,
    query: PaginationQuery,
  ): Promise<ExplorePostIdsPage> {
    const decoded = this.decodeCursorOrThrow(query.cursor);
    const windowStart = new Date(
      Date.now() - EXPLORE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const cursorFilter = decoded
      ? Prisma.sql`AND (
          likes_count < ${decoded.likesCount}
          OR (likes_count = ${decoded.likesCount} AND created_at < ${decoded.createdAt})
          OR (likes_count = ${decoded.likesCount} AND created_at = ${decoded.createdAt} AND id < ${decoded.id})
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      { id: string; created_at: Date; likes_count: bigint }[]
    >`
      WITH candidates AS (
        SELECT
          p.id,
          p.created_at,
          (SELECT COUNT(*) FROM likes WHERE likes.post_id = p.id) AS likes_count
        FROM posts p
        WHERE p.deleted_at IS NULL
          AND p.created_at >= ${windowStart}
          AND p.author_id != ${viewerId}
          AND p.author_id NOT IN (
            SELECT following_id FROM follows WHERE follower_id = ${viewerId}
          )
      )
      SELECT id, created_at, likes_count FROM candidates
      WHERE true ${cursorFilter}
      ORDER BY likes_count DESC, created_at DESC, id DESC
      LIMIT ${query.limit + 1}
    `;

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeExploreCursor({
            likesCount: Number(lastRow.likes_count),
            createdAt: lastRow.created_at,
            id: lastRow.id,
          })
        : null;

    return { postIds: page.map((row) => row.id), nextCursor };
  }

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeExploreCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }
}
