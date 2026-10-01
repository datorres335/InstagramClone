# Database Design

Defines the PostgreSQL schema managed by Prisma 7 (`prisma/schema.prisma`). The `User`
and `RefreshToken` models below are implemented as of Milestone 2 — see
`prisma/schema.prisma` and `prisma/migrations/20260924043452_0001_init_user_auth/` for
the literal, current Prisma syntax and applied SQL. Every other table in this document
is still a logical design only, to be implemented (and re-verified against current
Prisma docs) in the milestone that adds it.

## 1. Conventions

- **Primary keys**: UUIDv7 (time-ordered UUIDs), stored as native `uuid`. UUIDv7 is
  chosen over UUIDv4 for index locality (monotonic-ish, so B-tree inserts don't
  fragment the way random UUIDv4s do) and over auto-increment integers to avoid leaking
  row counts / enabling enumeration. **Resolved (Milestone 2)**: Prisma 7 exposes this
  natively as `@default(uuid(7))` — confirmed working, current, non-deprecated API.
  Generation happens in the Prisma Client (application-level, immediately before
  `INSERT`), not as a Postgres column default — there is no `gen_random_uuid()`-style
  SQL default in the generated migration, so any row created outside Prisma Client
  (raw SQL, another tool) would need to supply its own id. This is a non-issue for us:
  all writes go through Prisma per `CLAUDE.md`'s "all application data must go through
  the NestJS API" rule.
- **Timestamps**: `createdAt` (`timestamptz`, default `now()`) and `updatedAt`
  (`timestamptz`, auto-updated) on every table. `deletedAt` (`timestamptz`, nullable) on
  tables that support soft delete (see §7).
- **Case-insensitive uniqueness**: `username` and `email` use the Postgres `citext`
  extension (enabled in the first migration) instead of manual `lower()` indexes, so
  uniqueness and lookups are both case-insensitive without query-side normalization
  bugs.
- **Naming**: tables/columns `snake_case` in the database (Prisma `@@map`/`@map`),
  `camelCase` in the Prisma Client / TypeScript. Enums are `SCREAMING_SNAKE_CASE`
  values.
- **Soft delete over hard delete** for user-generated content (`User`, `Post`,
  `Comment`) to preserve referential integrity (a deleted user's posts shouldn't orphan
  likes/comments mid-flight) and allow recovery; hard delete only for pure join/state
  rows (`Follow`, `Like`, `SavedPost`) where "delete" _is_ the product action
  (unfollow/unlike/unsave).

## 2. Entity Overview

```
User ──1:N──▶ RefreshToken
User ──1:N──▶ Post ──1:N──▶ PostMedia ──N:1──▶ Media
User ──1:N──▶ Media                (avatar / post images; Media is a generic asset table)
User ──N:N──▶ User        (Follow: follower ↔ following)
User ──N:N──▶ Post        (Like: user ↔ post)
User ──N:N──▶ Post        (SavedPost: user ↔ post)
Post ──1:N──▶ Comment ──N:1──▶ User (author)
User ──1:N──▶ Notification (recipient); Notification ──N:1──▶ User (actor, nullable)
```

## 3. Tables

### 3.1 `User`

| Column                            | Type        | Constraints                                                                                                                   |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| id                                | uuid        | PK                                                                                                                            |
| username                          | citext      | unique, not null, 3–30 chars, validated by `packages/validation`                                                              |
| email                             | citext      | unique, not null                                                                                                              |
| passwordHash                      | text        | not null (argon2id hash)                                                                                                      |
| fullName                          | text        | nullable                                                                                                                      |
| bio                               | text        | nullable, max 150 chars (Instagram-like limit)                                                                                |
| websiteUrl                        | text        | nullable                                                                                                                      |
| isPrivate                         | boolean     | not null, default `false` — reserved for a future follow-request workflow; MVP follow is always immediate (see `FEATURES.md`) |
| tokenVersion                      | int         | not null, default `0` — bumped to invalidate all outstanding access tokens (e.g. on password change)                          |
| emailVerifiedAt                   | timestamptz | nullable — column reserved; MVP does not require verification before login (see `FEATURES.md`)                                |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                                                                                                               |
| avatarMediaId                     | uuid        | nullable, **unique**, FK → `Media.id`, `onDelete: SetNull` — implemented Milestone 9, see below                               |

**Deviation from the original design (Milestone 2, resolved Milestone 9):**
`avatarMediaId` was not part of the Milestone 2 migration — it's a nullable FK to
`Media`, and `Media` didn't exist until Milestone 9 (media pipeline); adding the column
earlier would have meant either a fake/no-op FK or a dangling nullable column with no
relation for seven milestones. It landed in the same migration that created `Media`
(`prisma/migrations/..._0002_media`), alongside the actual relation and index, exactly
as originally planned. One addition beyond the original plan: the column is `@unique`
(a true one-to-one with `Media`) — a given media row being at most one user's avatar is
a real invariant, not an incidental constraint, and Prisma's schema DSL requires a
unique column on the defining side for a one-to-one relation to be expressible at all.

Indexes: unique(`username`), unique(`email`), index(`deletedAt`). **Deviation:** this is
a plain B-tree index, not the partial index (`WHERE deletedAt IS NULL`) originally
specified here. Prisma's schema DSL has no partial-index syntax, so a partial index
would mean hand-maintaining raw SQL outside Prisma's migration diffing indefinitely —
real complexity for a micro-optimization with zero rows to benefit from it yet. A plain
index is correct and sufficient today; revisit only if real query-performance data
justifies the added maintenance cost.

### 3.2 `RefreshToken`

Backs the rotating-refresh-token auth design in `ARCHITECTURE.md` §7.

| Column              | Type        | Constraints                                                      |
| ------------------- | ----------- | ---------------------------------------------------------------- |
| id                  | uuid        | PK                                                               |
| userId              | uuid        | FK → `User.id`, not null                                         |
| familyId            | uuid        | not null — shared by every token descended from one login        |
| tokenHash           | text        | unique, not null (SHA-256 of the opaque token)                   |
| userAgent           | text        | nullable (session/device display info)                           |
| ipAddress           | inet        | nullable                                                         |
| expiresAt           | timestamptz | not null                                                         |
| revokedAt           | timestamptz | nullable                                                         |
| replacedByTokenHash | text        | nullable — set on rotation, supports reuse-detection audit trail |
| createdAt           | timestamptz | default `now()`                                                  |

Indexes: unique(`tokenHash`), index(`userId`, `familyId`), index(`expiresAt`) (for a
periodic cleanup job removing long-expired rows).

### 3.3 `Media` (implemented Milestone 9)

A single generic asset table for **both** avatars and post images, rather than separate
`Avatar`/`PostImage` tables — an avatar and a post image go through the identical
presign → upload → process pipeline (`ARCHITECTURE.md` §8), so modeling them once avoids
duplicating that state machine.

| Column         | Type                               | Constraints                                                                                            |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| id             | uuid                               | PK                                                                                                     |
| ownerId        | uuid                               | FK → `User.id`, not null                                                                               |
| purpose        | enum(`AVATAR`, `POST_IMAGE`)       | not null                                                                                               |
| status         | enum(`PENDING`, `READY`, `FAILED`) | not null, default `PENDING`                                                                            |
| storageKey     | text                               | not null — original upload's object key                                                                |
| variants       | jsonb                              | nullable — e.g. `{ "thumbnail": "key...", "feed": "key..." }`, populated when `status` becomes `READY` |
| width / height | int                                | nullable until processed                                                                               |
| blurhash       | text                               | nullable — low-cost placeholder for progressive image loading                                          |
| byteSize       | int                                | not null                                                                                               |
| contentType    | text                               | not null                                                                                               |
| failureReason  | text                               | nullable                                                                                               |
| createdAt      | timestamptz                        | default `now()`                                                                                        |

Indexes: index(`ownerId`, `status`).

`jsonb` for `variants` (rather than a `MediaVariant` child table) is a deliberate
trade-off: variant keys are a small, fixed, code-defined set (`thumbnail`, `feed`,
`original`), not independently queryable data, so a child table would only add joins
without adding query power.

### 3.4 `Post` (implemented Milestone 11)

| Column                            | Type        | Constraints                                |
| --------------------------------- | ----------- | ------------------------------------------ |
| id                                | uuid        | PK                                         |
| authorId                          | uuid        | FK → `User.id`, not null                   |
| caption                           | text        | nullable, max ~2200 chars                  |
| location                          | text        | nullable, free-text for MVP (no geocoding) |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                            |

Indexes: index(`authorId`, `createdAt DESC`) — the core query for "posts by this user,
newest first" (profile grid) and a building block of the feed query (see §6).
**Deviation:** a plain (non-partial) index, not `WHERE deletedAt IS NULL` as originally
specified — Prisma's schema DSL has no partial-index syntax, the same gap and the same
resolution already recorded for `User.deletedAt` (Milestone 2, §3.1).

### 3.5 `PostMedia` (implemented Milestone 11)

Join table giving a `Post` an ordered list of one-or-more `Media` (multiple images per
post).

| Column   | Type     | Constraints                                         |
| -------- | -------- | --------------------------------------------------- |
| id       | uuid     | PK                                                  |
| postId   | uuid     | FK → `Post.id`, not null, `onDelete: Cascade`       |
| mediaId  | uuid     | FK → `Media.id`, not null, **unique**               |
| position | smallint | not null — 0-based order within the post's carousel |
| altText  | text     | nullable — accessibility                            |

Indexes: unique(`postId`, `position`). **Deviation:** `mediaId` is `@unique` on its own,
not merely part of a `unique(postId, mediaId)` pair as originally specified — a media
row must be attachable to at most one post _ever_ ("not already attached elsewhere",
`API.md` §7), not merely not-twice-to-the-same-post; a lone-`mediaId` unique constraint
is what actually enforces that at the database level (and makes the originally-specified
`unique(postId, mediaId)` redundant, since a unique `mediaId` already implies it) — the
same "the stricter constraint is the real invariant" reasoning Milestone 9 applied to
`User.avatarMediaId`. A check constraint at the application layer (enforced in
`PostsService`, not the DB) caps carousel length at 10 images, matching Instagram's own
limit.

### 3.6 `Follow` (implemented Milestone 10)

| Column      | Type        | Constraints              |
| ----------- | ----------- | ------------------------ |
| followerId  | uuid        | FK → `User.id`, not null |
| followingId | uuid        | FK → `User.id`, not null |
| createdAt   | timestamptz | default `now()`          |

Composite PK (`followerId`, `followingId`); a check constraint `followerId <>
followingId` prevents self-follows. Two indexes are needed because the composite PK
only efficiently serves lookups starting with `followerId`:

- Composite PK (`followerId`, `followingId`) → serves "who does X follow" /
  "does X follow Y" and the feed's `authorId IN (SELECT followingId FROM follow WHERE
followerId = :me)` query.
- Explicit secondary index on (`followingId`, `followerId`) → serves "who follows X"
  (followers list) and follower-count aggregates.

No status/approval column in the MVP — every follow is immediate, even for
`isPrivate` accounts (see `FEATURES.md` for the explicit scope note); adding a
`FollowRequest` table later is additive and doesn't require touching `Follow` itself.

**As implemented:** the table maps to `follows` (plural, matching every other table's
convention). Prisma's schema DSL has no portable `@@check` attribute, so the
`followerId <> followingId` constraint was added by hand to the migration SQL rather
than expressed in `schema.prisma` — `FollowsService` also rejects self-follows at the
application layer (for a clean `409`, docs/API.md §5), so the DB constraint is a
backstop, not the primary enforcement path.

### 3.7 `Like` (implemented Milestone 13)

| Column    | Type        | Constraints                                   |
| --------- | ----------- | --------------------------------------------- |
| userId    | uuid        | FK → `User.id`, not null                      |
| postId    | uuid        | FK → `Post.id`, not null, `onDelete: Cascade` |
| createdAt | timestamptz | default `now()`                               |

Composite PK (`userId`, `postId`) — doubles as the uniqueness constraint (a user can
only like a post once) and the primary access path ("has this user liked this post").
Secondary index (`postId`) for "count/list likers of a post" and like-count aggregates.

### 3.8 `Comment` (implemented Milestone 14)

| Column                            | Type        | Constraints                                      |
| --------------------------------- | ----------- | ------------------------------------------------ |
| id                                | uuid        | PK                                               |
| postId                            | uuid        | FK → `Post.id`, not null, `onDelete: Cascade`    |
| authorId                          | uuid        | FK → `User.id`, not null, `onDelete: Cascade`    |
| body                              | text        | not null, max ~2200 chars                        |
| parentCommentId                   | uuid        | FK → `Comment.id`, nullable, `onDelete: SetNull` |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                                  |

Indexes: index(`postId`, `createdAt`) for paginated comment listing — a plain B-tree,
not a partial `WHERE deletedAt IS NULL` index (Prisma has no portable partial-index
syntax, the same deviation already recorded for `User.deletedAt`/`Post`'s own index);
index(`parentCommentId`).

`parentCommentId` is included in the schema from the start even though the MVP feature
(`FEATURES.md` #12, "Comments") only requires **flat** comments — reserving the column
now avoids an awkward migration to add threading later, and the MVP API simply never
lets a client set it (always `null`) while the column and index already exist.
`authorId`'s `onDelete: Cascade` matches every other `User`-owned row in this schema
(`Post`, `Like`, `Follow`); `parentCommentId`'s `onDelete: SetNull` is Prisma's own
default for a nullable self-relation (not explicitly specified in this section
originally) and is the correct choice regardless — a reply losing its parent pointer
rather than being deleted or blocking the parent's own deletion, though this is purely
theoretical in the MVP since no code path ever sets `parentCommentId`.

### 3.9 `SavedPost`

| Column    | Type        | Constraints                                   |
| --------- | ----------- | --------------------------------------------- |
| userId    | uuid        | FK → `User.id`, not null                      |
| postId    | uuid        | FK → `Post.id`, not null, `onDelete: Cascade` |
| createdAt | timestamptz | default `now()`                               |

Composite PK (`userId`, `postId`). Secondary index not needed beyond the PK since the
only query pattern is "this user's saved posts, newest first" →
`WHERE userId = :me ORDER BY createdAt DESC`, served by extending the PK's leading
column with a sort — add index(`userId`, `createdAt DESC`) explicitly, since a composite
PK's implicit index is ordered by (`userId`, `postId`), not by `createdAt`.

### 3.10 `Notification`

| Column      | Type                              | Constraints                                                   |
| ----------- | --------------------------------- | ------------------------------------------------------------- |
| id          | uuid                              | PK                                                            |
| recipientId | uuid                              | FK → `User.id`, not null                                      |
| actorId     | uuid                              | FK → `User.id`, nullable (system notifications have no actor) |
| type        | enum(`FOLLOW`, `LIKE`, `COMMENT`) | not null                                                      |
| postId      | uuid                              | FK → `Post.id`, nullable, `onDelete: Cascade`                 |
| commentId   | uuid                              | FK → `Comment.id`, nullable, `onDelete: Cascade`              |
| isRead      | boolean                           | not null, default `false`                                     |
| createdAt   | timestamptz                       | default `now()`                                               |

Indexes: index(`recipientId`, `isRead`, `createdAt DESC`) — the notification list/badge
query.

Nullable `postId`/`commentId` foreign keys are used instead of a polymorphic
`(entityType, entityId)` pair: with only three notification types in the MVP, explicit
nullable FKs keep referential integrity enforced by Postgres itself (a dangling
notification is structurally impossible) at the cost of two nullable columns — a
trade-off documented as intentional. If the notification type set grows much larger
(e.g. with mentions, tags, future DMs), revisit in favor of a polymorphic reference or
per-type tables.

## 4. Enums

```
MediaPurpose:      AVATAR | POST_IMAGE
MediaStatus:       PENDING | READY | FAILED
NotificationType:  FOLLOW | LIKE | COMMENT
```

## 5. Extensions Required

- `citext` — case-insensitive `username`/`email`. **Enabled in migration
  `0001_init_user_auth` (Milestone 2)**, since `User.username`/`User.email` use it
  directly.
- `pg_trgm` — trigram indexes powering `ILIKE`/similarity search on `username` and
  `fullName` for the User Search feature (`CREATE INDEX ... USING gin (username
gin_trgm_ops)`). **Deferred** to the Milestone 17 migration that actually adds the
  trigram index, not enabled speculatively — see the deviation note below.

**Deviation from the original design:** this section originally said to enable all
extensions used anywhere in the schema — including `pgcrypto`, for UUID generation —
in the very first migration, on the theory that "retrofitting an extension is cheap but
retrofitting the columns/indexes that depend on it later is not." In practice:
`pgcrypto` turned out to be unnecessary — Prisma 7's `@default(uuid(7))` generates ids
in the Prisma Client, not via a Postgres function, so no crypto extension is needed for
primary keys at all (see §1). And enabling `pg_trgm` now, with nothing using it, would
just be dead configuration until Milestone 17 — the "cheap now, expensive later" argument
doesn't actually apply to extensions the way it does to columns/indexes, since enabling
an extension in the _same_ migration that first uses it costs nothing extra. Each
extension is now enabled in the migration that first has a column or index depending on
it, per `CLAUDE.md`'s "do not implement future features unless explicitly requested in
the current milestone."

## 6. Key Query Patterns

| Query                                                                                            | Approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home feed (posts from followed accounts, newest first, paginated) — **implemented Milestone 12** | Two queries, not one correlated subquery: `SELECT following_id FROM follow WHERE follower_id = :me`, then `SELECT ... FROM post WHERE author_id IN (:followingIds) AND deleted_at IS NULL ORDER BY created_at DESC, id DESC`, keyset-paginated (`createdAt`, `id`), not `OFFSET`. Prisma issues these as two round trips rather than the single nested-subquery form originally sketched here — functionally equivalent, and short-circuits entirely (no `Post` query at all) when the caller follows nobody. See §7 for the fan-out trade-off this implies. |
| Profile grid (a user's own posts)                                                                | Served directly by index(`authorId`, `createdAt DESC`) on `Post`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Followers / following list                                                                       | Served by `Follow`'s composite PK (following-list direction) and the secondary (`followingId`, `followerId`) index (followers direction), each paginated by `createdAt`.                                                                                                                                                                                                                                                                                                                                                                                     |
| Explore page                                                                                     | `Post`s from accounts the user does _not_ follow, ranked by a simple recency+engagement heuristic for MVP (e.g. like-count within the last N days) — computed with an aggregate query, not a precomputed ranking table; acceptable at MVP scale, called out as a scaling risk below.                                                                                                                                                                                                                                                                         |
| User search                                                                                      | `SELECT ... WHERE username % :query OR full_name % :query ORDER BY similarity(username, :query) DESC LIMIT :n` using `pg_trgm`'s `%` similarity operator against the GIN trigram index.                                                                                                                                                                                                                                                                                                                                                                      |
| Post detail/feed likes count + is-liked-by-me — **implemented Milestone 13**                     | Two queries per page, not one combined query with subqueries: `SELECT postId, COUNT(*) FROM likes WHERE postId IN (:ids) GROUP BY postId` for counts, and `SELECT postId FROM likes WHERE userId = :me AND postId IN (:ids)` for the viewer's own likes — run via `Promise.all`, batched for a whole page (e.g. the feed) in one pair of calls, not per-post.                                                                                                                                                                                                |
| Post detail/feed comments count — **implemented Milestone 14**                                   | `SELECT postId, COUNT(*) FROM comments WHERE postId IN (:ids) AND deletedAt IS NULL GROUP BY postId`, batched for a whole page the same way the likes count is, minus the per-viewer dimension a comment count doesn't need.                                                                                                                                                                                                                                                                                                                                 |

## 7. Soft Delete

`User`, `Post`, and `Comment` carry `deletedAt`. Every read path filters
`WHERE deletedAt IS NULL` — enforced centrally via a Prisma Client extension
(`$extends`) that injects the filter on `findMany`/`findFirst`/`findUnique` for these
three models, so individual services can't forget it. Hard deletes are never issued for
these models from application code; a scheduled job may hard-delete rows past a
retention window (e.g. 30 days after `deletedAt`) if/when that policy is needed — not
built in the MVP.

`Follow`, `Like`, `SavedPost` are hard-deleted on unfollow/unlike/unsave, since "the row
existing" _is_ the entire meaning of these tables — there's no soft-delete concept that
adds value.

## 8. Migrations

- Managed by Prisma Migrate; one migration per milestone in `IMPLEMENTATION_PLAN.md`
  (e.g. `0001_init_user_auth`, `0002_media`, `0003_posts`, ...) rather than one giant
  initial migration, so each milestone's schema change is reviewable and revertible
  independently, and `prisma/migrations` doubles as a changelog of the data model's
  growth. Prisma prefixes each migration folder with a generation timestamp
  (`prisma migrate dev --name <name>` produces
  `prisma/migrations/<yyyymmddhhmmss>_<name>/`) — the `000N_*` name is ours, for
  ordering-at-a-glance in this doc; the timestamp prefix is what Prisma actually reads.
- `prisma migrate dev` locally; `prisma migrate deploy` in CI/production — never
  `db push` outside of local prototyping, so migration history stays authoritative.
- Destructive changes (column drops/renames) get an explicit expand/contract note in the
  migration's PR description once the project is past its very first schema.

## 9. Seeding

`prisma/seed.ts` creates a small, deterministic dataset for local development and for
API integration tests to run against: a handful of users (including one with a private
account, one with no posts, one with many posts) with follow relationships, posts with
1–3 images each, likes, comments, and a few notifications — enough to exercise every
feed/pagination/empty-state path without relying on production-scale data.

## 10. Scaling Considerations (explicitly deferred, not built in MVP)

- **Feed fan-out-on-read** (§6) is simple and correct but its `authorId IN (...)`
  subquery grows with how many accounts a user follows, and a celebrity account being
  liked/followed at high volume creates hot rows. A fan-out-on-write model (a
  precomputed `FeedEntry(userId, postId, createdAt)` table populated by a background job
  when a followed account posts) is the standard fix, deferred until real usage
  patterns justify the added write amplification and complexity.
- **Explore ranking** computed live via aggregate queries is fine at MVP scale; a
  real ranking pipeline (precomputed scores, ML-based relevance) is out of scope.
- **Notification writes** are enqueued through BullMQ rather than written synchronously
  in the triggering request specifically to avoid a write storm against this table
  during a burst of engagement on one post (`ARCHITECTURE.md` risk #10).
