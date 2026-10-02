import { Injectable } from '@nestjs/common';

import type {
  FollowListItem,
  FollowListResponse,
  SearchUsersQuery,
} from '@instagram-clone/validation';

import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * `GET /search/users?q=` (docs/API.md §11, docs/DATABASE.md §6) — ranked by
   * `pg_trgm` similarity, the exact query pattern docs/DATABASE.md §6
   * specifies (`WHERE username % :q OR full_name % :q ORDER BY
   * similarity(username, :q) DESC`). Reuses `FollowListResponse`/
   * `FollowListItem` verbatim rather than a new type — a search result row
   * is the identical "avatar/username/full name + follow affordance" shape
   * a followers/following/likers list row already is, the same precedent
   * Milestone 13 established for the likers list. Always `nextCursor: null`
   * — see `packages/validation/src/lib/search.ts`'s doc comment for why
   * this endpoint has no keyset pagination at all.
   */
  async searchUsers(
    query: SearchUsersQuery,
    viewerId: string | undefined,
  ): Promise<FollowListResponse> {
    // The trigram ranking itself needs raw SQL — `%`/`similarity()` aren't
    // expressible through Prisma's query builder (docs/DATABASE.md §6).
    // Scoped to just this one ranked-id lookup, not the whole row, so the
    // rest of the pipeline (avatar resolution, isFollowedByMe) can stay on
    // the ordinary Prisma query builder.
    //
    // Ranks by GREATEST(username, fullName) similarity, not username alone
    // (docs/DATABASE.md §6's originally-documented pattern, corrected in
    // Milestone 20): ordering by username-similarity only meant a user
    // matched purely on a strong fullName hit, with a username that happens
    // to share little trigram overlap with the query, could rank far below
    // unrelated users whose username has marginally higher noise-level
    // similarity — on a dev database with hundreds of accumulated e2e
    // accounts, "far below" meant falling off the single, uncursored page
    // entirely. Found via `apps/api-e2e/src/search/search.spec.ts`'s
    // "matches on fullName as well as username" test turning genuinely
    // flaky (not a throttle or timing issue — confirmed by running it in
    // isolation, where it always passed) as this session's own earlier
    // hardening-pass test runs accumulated yet more dev-database noise.
    const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE deleted_at IS NULL AND (username % ${query.q} OR full_name % ${query.q})
      ORDER BY GREATEST(similarity(username, ${query.q}), similarity(full_name, ${query.q})) DESC
      LIMIT ${query.limit}
    `;
    const ids = ranked.map((row) => row.id);
    if (ids.length === 0) {
      return { data: [], meta: { nextCursor: null } };
    }

    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: { avatarMedia: true },
    });

    // `findMany({ where: { id: { in } } })` doesn't preserve input order —
    // re-sort to match the similarity-ranked order the id list was already
    // computed in, the same pattern `SavedPostsService.getSavedPosts`
    // established for its own id-list-then-rehydrate query.
    const userById = new Map(rows.map((row) => [row.id, row]));
    const orderedUsers = ids
      .map((id) => userById.get(id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined);

    // One extra query for the whole page's isFollowedByMe, not one per row
    // — the same batching `FollowsService`'s list endpoints and
    // `LikesService.getLikers` already established.
    const followedIds =
      viewerId && orderedUsers.length > 0
        ? new Set(
            (
              await this.prisma.follow.findMany({
                where: {
                  followerId: viewerId,
                  followingId: { in: orderedUsers.map((user) => user.id) },
                },
                select: { followingId: true },
              })
            ).map((edge) => edge.followingId),
          )
        : null;

    const data: FollowListItem[] = orderedUsers.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: this.mediaService.resolveAvatarUrl(user.avatarMedia),
      isFollowedByMe: followedIds ? followedIds.has(user.id) : null,
    }));

    return { data, meta: { nextCursor: null } };
  }
}
