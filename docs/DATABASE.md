# Database Design

Defines the PostgreSQL schema managed by Prisma 7 (`prisma/schema.prisma`). This is a
logical design — field names/types below are what the Prisma schema should express, not
literal Prisma syntax, since exact Prisma 7 syntax (driver adapters, `prisma.config.ts`)
should be confirmed against current docs at implementation time (see `ARCHITECTURE.md`
risk #1).

## 1. Conventions

- **Primary keys**: UUIDv7 (time-ordered UUIDs) generated at the database or Prisma
  level, stored as native `uuid`. UUIDv7 is chosen over UUIDv4 for index locality
  (monotonic-ish, so B-tree inserts don't fragment the way random UUIDv4s do) and over
  auto-increment integers to avoid leaking row counts / enabling enumeration. Confirm at
  implementation time whether Prisma 7 exposes a native `uuid(7)` default or whether it
  should be generated in application code / via a Postgres default
  (`gen_random_uuid()` from `pgcrypto` only gives v4 — a v7 default likely needs either
  a small SQL function or app-level generation with a library such as `uuidv7`).
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
| avatarMediaId                     | uuid        | FK → `Media.id`, nullable                                                                                                     |
| isPrivate                         | boolean     | not null, default `false` — reserved for a future follow-request workflow; MVP follow is always immediate (see `FEATURES.md`) |
| tokenVersion                      | int         | not null, default `0` — bumped to invalidate all outstanding access tokens (e.g. on password change)                          |
| emailVerifiedAt                   | timestamptz | nullable — column reserved; MVP does not require verification before login (see `FEATURES.md`)                                |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                                                                                                               |

Indexes: unique(`username`), unique(`email`), index(`deletedAt`) (partial index
`WHERE deletedAt IS NULL` used by most queries).

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

### 3.3 `Media`

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

### 3.4 `Post`

| Column                            | Type        | Constraints                                |
| --------------------------------- | ----------- | ------------------------------------------ |
| id                                | uuid        | PK                                         |
| authorId                          | uuid        | FK → `User.id`, not null                   |
| caption                           | text        | nullable, max ~2200 chars                  |
| location                          | text        | nullable, free-text for MVP (no geocoding) |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                            |

Indexes: index(`authorId`, `createdAt DESC`) — the core query for "posts by this user,
newest first" (profile grid) and a building block of the feed query (see §6). Partial
index `WHERE deletedAt IS NULL`.

### 3.5 `PostMedia`

Join table giving a `Post` an ordered list of one-or-more `Media` (multiple images per
post).

| Column   | Type     | Constraints                                         |
| -------- | -------- | --------------------------------------------------- |
| id       | uuid     | PK                                                  |
| postId   | uuid     | FK → `Post.id`, not null, `onDelete: Cascade`       |
| mediaId  | uuid     | FK → `Media.id`, not null                           |
| position | smallint | not null — 0-based order within the post's carousel |
| altText  | text     | nullable — accessibility                            |

Indexes: unique(`postId`, `position`); unique(`postId`, `mediaId`) so the same media
asset can't be attached twice to one post. A check constraint at the application layer
(enforced in the create-post service, not the DB) caps carousel length (e.g. 10 images,
matching Instagram's own limit).

### 3.6 `Follow`

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

### 3.7 `Like`

| Column    | Type        | Constraints                                   |
| --------- | ----------- | --------------------------------------------- |
| userId    | uuid        | FK → `User.id`, not null                      |
| postId    | uuid        | FK → `Post.id`, not null, `onDelete: Cascade` |
| createdAt | timestamptz | default `now()`                               |

Composite PK (`userId`, `postId`) — doubles as the uniqueness constraint (a user can
only like a post once) and the primary access path ("has this user liked this post").
Secondary index (`postId`) for "count/list likers of a post" and like-count aggregates.

### 3.8 `Comment`

| Column                            | Type        | Constraints                                   |
| --------------------------------- | ----------- | --------------------------------------------- |
| id                                | uuid        | PK                                            |
| postId                            | uuid        | FK → `Post.id`, not null, `onDelete: Cascade` |
| authorId                          | uuid        | FK → `User.id`, not null                      |
| body                              | text        | not null, max ~2200 chars                     |
| parentCommentId                   | uuid        | FK → `Comment.id`, nullable                   |
| createdAt / updatedAt / deletedAt | timestamptz | see conventions                               |

Indexes: index(`postId`, `createdAt`) for paginated comment listing; index
(`parentCommentId`).

`parentCommentId` is included in the schema from the start even though the MVP feature
(`FEATURES.md` #12, "Comments") only requires **flat** comments — reserving the column
now avoids an awkward migration to add threading later, and the MVP API simply never
lets a client set it (always `null`) while the column and index already exist.

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

- `citext` — case-insensitive `username`/`email`.
- `pgcrypto` — UUID generation helpers (exact function depends on the UUIDv7 approach
  chosen at implementation time, see §1).
- `pg_trgm` — trigram indexes powering `ILIKE`/similarity search on `username` and
  `fullName` for the User Search feature (`CREATE INDEX ... USING gin (username
gin_trgm_ops)`).

All three are enabled in the very first migration, since retrofitting an extension is
cheap but retrofitting the _columns/indexes_ that depend on it later is not.

## 6. Key Query Patterns

| Query                                                             | Approach                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home feed (posts from followed accounts, newest first, paginated) | `SELECT ... FROM post WHERE author_id IN (SELECT following_id FROM follow WHERE follower_id = :me) AND deleted_at IS NULL ORDER BY created_at DESC, id DESC` with a **cursor** (`createdAt`, `id`) keyset, not `OFFSET`, so pagination stays O(page size) regardless of depth. See §7 for the fan-out trade-off this implies. |
| Profile grid (a user's own posts)                                 | Served directly by index(`authorId`, `createdAt DESC`) on `Post`.                                                                                                                                                                                                                                                             |
| Followers / following list                                        | Served by `Follow`'s composite PK (following-list direction) and the secondary (`followingId`, `followerId`) index (followers direction), each paginated by `createdAt`.                                                                                                                                                      |
| Explore page                                                      | `Post`s from accounts the user does _not_ follow, ranked by a simple recency+engagement heuristic for MVP (e.g. like-count within the last N days) — computed with an aggregate query, not a precomputed ranking table; acceptable at MVP scale, called out as a scaling risk below.                                          |
| User search                                                       | `SELECT ... WHERE username % :query OR full_name % :query ORDER BY similarity(username, :query) DESC LIMIT :n` using `pg_trgm`'s `%` similarity operator against the GIN trigram index.                                                                                                                                       |
| Post detail (likes count, comments, is-liked-by-me)               | Single query with aggregate subqueries/joins on `Like`/`Comment`, plus one `EXISTS` check against `Like` for the requesting user.                                                                                                                                                                                             |

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
  growth.
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
