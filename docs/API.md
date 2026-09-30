# API Design

REST API served by `apps/api` (NestJS). This document defines conventions and the
endpoint surface for the MVP feature set; it is the contract `packages/api-client` is
generated/written against (see `ARCHITECTURE.md` §6.2).

## 1. Conventions

- **Base path & versioning**: `/api/v1/...` via Nest's built-in URI versioning. Every
  route is versioned from the first commit, even with only `v1` existing.
- **Content type**: `application/json` for requests/responses; `application/problem+json`
  for errors (RFC 7807).
- **Auth**: `Authorization: Bearer <accessToken>` header on every protected endpoint.
  The refresh token is never sent as a bearer token — only via the httpOnly cookie
  (web) or explicitly in the `/auth/refresh` body (mobile). See §3.
- **Pagination**: cursor-based on every list endpoint. Request: `?cursor=<opaque>&limit=<n>`
  (`limit` default 20, max 50). Response envelope:
  ```json
  {
    "data": [
      /* items */
    ],
    "meta": { "nextCursor": "opaque-string-or-null" }
  }
  ```
  The cursor is an opaque, base64-encoded `(createdAt, id)` pair — clients must treat it
  as opaque, never construct one. No `OFFSET` pagination is exposed, to keep query plans
  bounded regardless of page depth (see `DATABASE.md` §6).
- **Single-resource responses** are returned unwrapped (no `data` envelope) —
  `GET /posts/:id` returns the post object directly; only _list_ endpoints use the
  `{ data, meta }` envelope.
- **Errors**: RFC 7807 Problem Details —
  ```json
  {
    "type": "https://api.instagram-clone.dev/errors/validation-failed",
    "title": "Validation failed",
    "status": 400,
    "detail": "caption must be at most 2200 characters",
    "instance": "/api/v1/posts",
    "errors": [{ "path": "caption", "message": "..." }]
  }
  ```
  `errors[]` (field-level detail) is present for `400 Validation Failed` responses,
  produced directly from the Zod schema's issue list.
- **Idempotent toggles use `PUT`/`DELETE`, not `POST`**, for follow/like/save, so a
  retried request is safe: `PUT` = ensure the relationship exists, `DELETE` = ensure it
  doesn't. Both return `204 No Content` whether or not the call changed state.
- **Rate limiting**: `@nestjs/throttler`, applied globally (100 req/min/IP) with
  stricter per-route limits on `/auth/login`, `/auth/refresh` (10 req/min/IP) and
  `/auth/register` (40 req/min/IP — raised from 10 to 20 in Milestone 9, then to 40
  in Milestone 12, both times because `apps/api-e2e`'s register calls are a shared
  per-run budget across every spec file against one server process, and the suite
  outgrew each previous limit; see `docs/PROGRESS.md`'s Milestone 12 deviations)
  to slow credential-stuffing/enumeration — implemented Milestone 5. In-memory
  storage, not Redis (see the deviation in `docs/PROGRESS.md`): correct for the
  single-process API this is today, revisit if `apps/api` is ever horizontally
  scaled.
- **CORS**: allow-list of known web origins only; credentials (`Access-Control-Allow-
Credentials: true`) enabled since the refresh cookie requires it.
- **OpenAPI**: generated at build time from the same Zod schemas (`nestjs-zod`),
  served at `/api/docs` (Swagger UI) outside production, exported as `openapi.json` for
  `packages/api-client` codegen.

## 2. Resource Map

| Resource         | Base path                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Auth             | `/api/v1/auth`                                                                                              |
| Users / profiles | `/api/v1/users`                                                                                             |
| Follows          | `/api/v1/users/:username/follow*`, `/api/v1/users/:username/followers`, `/api/v1/users/:username/following` |
| Media (uploads)  | `/api/v1/media`                                                                                             |
| Posts            | `/api/v1/posts`                                                                                             |
| Feed             | `/api/v1/feed`                                                                                              |
| Likes            | `/api/v1/posts/:postId/like*`                                                                               |
| Comments         | `/api/v1/posts/:postId/comments`                                                                            |
| Saved posts      | `/api/v1/posts/:postId/save*`, `/api/v1/me/saved`                                                           |
| Search           | `/api/v1/search/users`                                                                                      |
| Explore          | `/api/v1/explore`                                                                                           |
| Notifications    | `/api/v1/notifications`                                                                                     |
| Account settings | `/api/v1/me`                                                                                                |
| Health           | `/api/v1/health`                                                                                            |

## 3. Auth

Request/response shapes below are the literal Zod schemas in `packages/validation`
(`src/lib/auth.ts`, `src/lib/user.ts`) — implemented in Milestone 3; those schemas are
the single source of truth, this table just mirrors them.

| Method & path         | Auth\*                                                     | Body                                                              | Response                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/register` | none                                                       | `RegisterInputSchema`: `{ email, username, password, fullName? }` | `201` → `AuthResponseSchema`: `{ user, accessToken, accessTokenExpiresAt, refreshToken? }` + sets the refresh cookie (web)                                                                                                                                                                                                                                                |
| `POST /auth/login`    | none                                                       | `LoginInputSchema`: `{ emailOrUsername, password }`               | `200` → `AuthResponseSchema` (same shape as register)                                                                                                                                                                                                                                                                                                                     |
| `POST /auth/refresh`  | refresh cookie (web) or `RefreshInputSchema` body (mobile) | `RefreshInputSchema`: `{ refreshToken? }`                         | `200` → `RefreshResponseSchema`: `{ accessToken, accessTokenExpiresAt, refreshToken? }`, rotated cookie (web). `401 unauthenticated` if the token is unknown or naturally expired (no family revocation — expiry alone isn't suspicious). `401 refresh-token-reused` (§14), **with the whole token family revoked**, only when an already-rotated-away token is replayed. |
| `POST /auth/logout`   | refresh cookie (web) or `LogoutInputSchema` body (mobile)  | `LogoutInputSchema`: `{ refreshToken?, allDevices? }`             | `204` — revokes the presented token's family (or all of the user's families if `allDevices`)                                                                                                                                                                                                                                                                              |
| `GET /auth/session`   | access token                                               | —                                                                 | `200` → `SessionResponseSchema`: `{ user }` — cheap "am I logged in / who am I" check used by SSR                                                                                                                                                                                                                                                                         |

\* `refreshToken` is optional in `RefreshInputSchema`/`LogoutInputSchema` because it's
only ever sent by mobile clients — web relies on the httpOnly cookie exclusively and
sends no body at all for these two routes. In the other direction, `AuthResponseSchema`/
`RefreshResponseSchema`'s `refreshToken` field is always populated in the response body
(Milestone 5) — the API has no reliable way to tell a browser client from a mobile
client apart at register/login time, so rather than guess it returns the token both
ways: mobile reads it from the body since it has no cookie jar, and web is expected to
rely on the httpOnly cookie and simply ignore the body field. A dedicated client-type
signal to suppress it for browsers is deferred until an actual web client (Milestone 6)
exists to design that mechanism against.

`UserResponseSchema` (used as `user` above) is the _own-user_ shape returned from auth
endpoints — id, username, email, fullName, bio, websiteUrl, isPrivate, createdAt, never
`passwordHash`/`tokenVersion`/`deletedAt`/`emailVerifiedAt`. It is **not** the richer
public _profile_ shape (avatar, follower counts, `isFollowedByMe`) returned by
`GET /users/:username` in §4 — that's a separate, wider schema added in Milestone 8.

Registration does not require email verification before login in the MVP (see
`FEATURES.md`); `User.emailVerifiedAt` exists for a future verification flow.

Password policy (`passwordSchema`): 8–128 characters, no mandated character classes —
following NIST SP 800-63B guidance that complexity rules push users toward predictable
substitutions without meaningfully improving guessability; length is what matters.

## 4. Users & Profiles (`GET`/`PATCH /me` implemented Milestone 8)

| Method & path                | Auth     | Notes                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /users/:username`       | optional | Public profile: bio, avatar, post/follower/following counts, `isFollowedByMe` (only computed when authenticated)                                                                                                                                                                                                                                             |
| `GET /users/:username/posts` | optional | Paginated post grid for that user — returns real `PostSummary` items, cursor-paginated newest-first (**implemented Milestone 11**, see §7)                                                                                                                                                                                                                   |
| `PATCH /me`                  | required | Update own profile (`fullName`, `bio`, `websiteUrl`, `isPrivate`) — also see §10 (settings)                                                                                                                                                                                                                                                                  |
| `PATCH /me/avatar`           | required | Body `{ mediaId }` → `200` `MediaResponse` (§6) — must reference the caller's own `READY` `AVATAR`-purpose media (`403` if not the caller's own, `422 media-not-ready` — §14 — if wrong purpose or not `READY`). Returns the media resource, not `UserResponse`, since the latter deliberately never includes `avatarUrl` (§3) — **implemented Milestone 9** |
| `DELETE /me`                 | required | Soft-deletes the account (sets `deletedAt`); revokes all refresh token families — **Milestone 19**                                                                                                                                                                                                                                                           |

`GET /users/:username`'s `avatarUrl` resolves to a real URL once the user has a `READY`
`AVATAR` media set (implemented Milestone 9); `followersCount`/`followingCount` are real
as of Milestone 10 and `postsCount` is real as of Milestone 11 — the response schema
(`PublicProfileResponseSchema`, `packages/validation`) already had the shape those
milestones filled in, so none of this was a breaking change. `isFollowedByMe` is `null` for an unauthenticated
viewer, `false` for an authenticated one (never `true` yet — no `Follow` table to make
it true). Auth is genuinely optional here (`OptionalAuthGuard`,
`apps/api/src/modules/auth/`): a missing/invalid token is never rejected, just treated
as an anonymous viewer.

## 5. Follows (implemented Milestone 10)

| Method & path                    | Auth     | Notes                                                                                                      |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `PUT /users/:username/follow`    | required | Idempotent follow; `204`. `409 conflict` if attempting to follow self. `404` if `:username` doesn't exist. |
| `DELETE /users/:username/follow` | required | Idempotent unfollow; `204` whether or not the edge existed. `404` if `:username` doesn't exist.            |
| `GET /users/:username/followers` | optional | `200` → `FollowListResponse` (below), cursor-paginated (§1). `404` if `:username` doesn't exist.           |
| `GET /users/:username/following` | optional | Same shape, the accounts `:username` follows.                                                              |

No approval/request step in the MVP even for `isPrivate` accounts — see
`FEATURES.md` for the explicit scope decision and `DATABASE.md` §3.6.

`FollowListResponse`: `{ data: FollowListItem[], meta: { nextCursor } }`.
`FollowListItem`: `{ id, username, fullName, avatarUrl, isFollowedByMe }` — deliberately
narrower than `PublicProfileResponse` (no `bio`/`websiteUrl`/counts), matching
docs/FEATURES.md #6's "avatar/username/full name... a follow/unfollow affordance
inline." `isFollowedByMe` is computed relative to the _viewer_, not the list's subject
— on your own followers/following list, your own row (if present) always shows `false`
(a self-follow-state check, and self-follows are never possible), not an error; this is
expected, not a bug (see docs/PROGRESS.md's Milestone 10 known issues).

`GET /users/:username`'s `followersCount`/`followingCount`/`isFollowedByMe` (§4) are all
real as of this milestone — the first fields on that response that were hardcoded stubs
since Milestone 8 to become fully live before `Post` (Milestone 11) does.

## 6. Media (implemented Milestone 9)

| Method & path              | Auth     | Notes                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /media/presign`      | required | Body `{ purpose: 'AVATAR'\|'POST_IMAGE', contentType, byteSize }` → `201` `{ mediaId, uploadUrl, expiresAt }`. Server enforces size/type limits (≤ 8 MB — `413 payload-too-large` if exceeded, §14 — `image/jpeg`\|`image/png`\|`image/webp`, `400` otherwise) before issuing the URL. Creates a `Media` row in `PENDING` status.                                  |
| `POST /media/:id/complete` | required | `200` → `MediaResponse` (below). Confirms the upload exists in the bucket (`HEAD`), enqueues the variant-generation job. Idempotent: calling it again for an already-queued/processed media just returns its current state without re-enqueuing. `403` if `:id` isn't the caller's own media, `404` if it doesn't exist or the object was never actually uploaded. |
| `GET /media/:id`           | required | `200` → `MediaResponse`. Poll processing status — used by clients to know when a just-uploaded image is ready to attach to a post or set as an avatar. `403`/`404` same as above.                                                                                                                                                                                  |

`MediaResponse`: `{ id, purpose, status, variants, width, height, blurhash, failureReason, createdAt }`. `variants` is `null` until `status` is `READY`, then `{ thumbnail, feed }` — both resolved, publicly-fetchable URLs (`docs/ARCHITECTURE.md` §8 point 5), not storage keys. `width`/`height` describe the _original_ upload; `blurhash` is a placeholder string for progressive loading (not yet consumed by any client UI). `failureReason` is set only when `status` is `FAILED`.

## 7. Posts

`POST`/`GET`/`DELETE /posts*` implemented Milestone 11. `GET /feed` implemented
Milestone 12.

| Method & path       | Auth                   | Notes                                                                                                                                                                                            |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /posts`       | required               | Body `{ caption?, location?, mediaIds: string[] }` (1–10 items, order = array order); all `mediaIds` must be the caller's own `READY`, `POST_IMAGE`-purpose media not already attached elsewhere |
| `GET /posts/:id`    | optional               | Single post with author, media (ordered), counts, `isLikedByMe`/`isSavedByMe` when authenticated                                                                                                 |
| `DELETE /posts/:id` | required (author only) | Soft delete                                                                                                                                                                                      |
| `GET /feed`         | required               | The authenticated home feed — paginated posts from followed accounts, newest first (see `DATABASE.md` §6); a top-level resource, not nested under `/posts` — see §2's resource map               |

**`PostResponse`** (`GET`/`POST /posts*`'s single-post shape — a judgment call, since
this section only specified the fields at a high level before implementation):
`{ id, author: { id, username, fullName, avatarUrl }, caption, location, media:
[{ id, url, thumbnailUrl, width, height, blurhash, altText, position }], likesCount,
commentsCount, isLikedByMe, isSavedByMe, createdAt }`. `likesCount`/`isLikedByMe` are
real as of Milestone 13 (§8). `commentsCount` is still hardcoded `0` and `isSavedByMe`
still stubbed `false` for an authenticated viewer / `null` for anonymous (the same
null-for-anonymous convention `isFollowedByMe` established in Milestone 10) until
`Comment`/`SavedPost` exist (Milestones 14/15).

**`PostSummary`** (the profile-grid tile shape returned by `GET
/users/:username/posts`, deliberately minimal): `{ id, thumbnailUrl, createdAt }` —
only the carousel's first (`position: 0`) image is resolved per post, not the whole
media array, since a grid tile never needs more than a cover thumbnail.

**Error mapping for `POST /posts`** (reusing existing catalog entries rather than
minting new ones, per this codebase's established practice):

| Condition                                                     | Response                                          |
| ------------------------------------------------------------- | ------------------------------------------------- |
| A `mediaId` not owned by the caller                           | `403`/`404` (`getOwnedMedia`'s existing behavior) |
| A `mediaId` with the wrong `purpose` or not yet `READY`       | `422 media-not-ready` (reused from Milestone 9)   |
| The same `mediaId` listed twice in one request                | `409 conflict`                                    |
| A `mediaId` already attached to another post                  | `409 conflict`                                    |
| Fewer than 1 or more than 10 `mediaIds`                       | `400` (Zod validation)                            |
| A malformed pagination cursor on `GET /users/:username/posts` | `400`                                             |
| `DELETE /posts/:id` by a non-author                           | `403`                                             |

**`FeedResponse`** (`GET /feed`'s shape, Milestone 12): `{ data: PostResponse[], meta:
{ nextCursor } }` — full `PostResponse` items, not `PostSummary`, since
`docs/FEATURES.md` #10 says each feed item shows the whole carousel/caption/counts
inline, the same shape a post detail page needs; no separate "feed post" type was
introduced. Fan-out-on-read (`docs/DATABASE.md` §6, `docs/ARCHITECTURE.md` risk #3):
the caller's `following` edges are fetched once, then posts are queried with
`authorId IN (...)`, matching `DATABASE.md` §6's literal query shape. Cursor
pagination is the same opaque base64 `(createdAt, id)` pair every other paginated
endpoint uses (`GET /users/:username/posts`, followers/following). Never includes the
viewer's own posts — a real, non-obvious consequence of `Follow` never containing a
self-edge, not special-cased logic (`docs/FEATURES.md` #10's explicit default,
matching Instagram). A viewer following nobody gets `{ data: [], meta: { nextCursor:
null } }` without a wasted `Post` query (short-circuited once the `following` list
comes back empty). A malformed cursor is `400`; an unauthenticated request is `401`
(unlike `GET /posts/:id`, `GET /feed` has no anonymous-viewer mode — showing a feed
without a viewer to compute it for is meaningless).

## 8. Likes (implemented Milestone 13)

| Method & path                | Auth     | Notes                                      |
| ---------------------------- | -------- | ------------------------------------------ |
| `PUT /posts/:postId/like`    | required | Idempotent like; `204`                     |
| `DELETE /posts/:postId/like` | required | Idempotent unlike; `204`                   |
| `GET /posts/:postId/likes`   | optional | Paginated list of users who liked the post |

`PUT`/`DELETE` mirror `Follow`'s exact idempotent-toggle convention (Milestone 10) —
`upsert`/`deleteMany`, never a create-then-catch-conflict pattern. Both `404` for a
nonexistent/soft-deleted post. `GET /posts/:postId/likes` reuses `FollowListResponse`
verbatim, not a new `LikeListResponse` type — a likers list row (`{ id, username,
fullName, avatarUrl, isFollowedByMe }`) is the identical shape a followers/following
list row already is, `isFollowedByMe` computed relative to the viewer exactly the same
way. `PostResponse.likesCount`/`isLikedByMe` (docs/API.md §7) are real as of this
milestone, computed by `LikesService.getLikeStateForPosts` — batched per page (one
pair of queries for a whole feed page, not one per post), never per-row for a single
`GET /posts/:id` either, since that call always goes through the same batched method
with an array of one. **No `Notification` side effect**: `docs/FEATURES.md` #11
describes liking as generating a notification for the post's author, but
`docs/IMPLEMENTATION_PLAN.md` M13 explicitly offers deferring that to Milestone 16
(when `Notification` itself lands) as a sanctioned alternative to pulling the whole
notification pipeline forward — chosen here since implementing `Notification`'s
table/enqueue/consumer/list-endpoint/UI as a side effect of "Likes" would be
implementing most of Milestone 16 early, well beyond this milestone's own scope
(see `docs/PROGRESS.md`'s Milestone 13 deviations).

## 9. Comments

| Method & path                               | Auth                                     | Notes                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /posts/:postId/comments`              | required                                 | Body `{ body }` (max 2200 chars); MVP never accepts `parentCommentId` from the client even though the column exists (`DATABASE.md` §3.8) |
| `GET /posts/:postId/comments`               | optional                                 | Paginated, oldest-first (standard comment-thread convention)                                                                             |
| `DELETE /posts/:postId/comments/:commentId` | required (comment author or post author) | Soft delete                                                                                                                              |

## 10. Saved Posts

| Method & path                | Auth     | Notes                                      |
| ---------------------------- | -------- | ------------------------------------------ |
| `PUT /posts/:postId/save`    | required | Idempotent; `204`                          |
| `DELETE /posts/:postId/save` | required | Idempotent; `204`                          |
| `GET /me/saved`              | required | Paginated list of the caller's saved posts |

## 11. Search & Explore

| Method & path          | Auth     | Notes                                                                                                          |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /search/users?q=` | optional | `pg_trgm`-backed similarity search on username/fullName, paginated, min 2 chars                                |
| `GET /explore`         | required | Paginated posts from non-followed accounts, ranked by a simple recency+engagement heuristic (`DATABASE.md` §6) |

## 12. Notifications

| Method & path                     | Auth     | Notes                                                                                                 |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `GET /notifications`              | required | Paginated, newest first; each item includes `type`, `actor`, and the related `post`/`comment` summary |
| `GET /notifications/unread-count` | required | Cheap badge-count endpoint                                                                            |
| `POST /notifications/mark-read`   | required | Body `{ notificationIds?: string[] }` — omit to mark all as read                                      |

MVP is poll-based (clients refetch `/notifications/unread-count` periodically); no
WebSocket/SSE transport (`ARCHITECTURE.md` non-goals).

## 13. Account Settings

| Method & path              | Auth     | Notes                                                                                                          |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `PATCH /me`                | required | See §4 — profile fields                                                                                        |
| `POST /me/change-password` | required | Body `{ currentPassword, newPassword }`; bumps `User.tokenVersion` to invalidate other sessions' access tokens |
| `POST /me/change-email`    | required | Body `{ newEmail, currentPassword }`                                                                           |
| `DELETE /me`               | required | See §4                                                                                                         |

## 14. Error Catalog (representative, not exhaustive)

| Status | `type` slug            | When                                                                   |
| ------ | ---------------------- | ---------------------------------------------------------------------- |
| 400    | `validation-failed`    | Zod schema rejects the request body/query                              |
| 401    | `unauthenticated`      | Missing/invalid/expired access token                                   |
| 401    | `refresh-token-reused` | A rotated-away refresh token was replayed — family revoked             |
| 403    | `forbidden`            | Authenticated but not permitted (e.g. deleting someone else's comment) |
| 404    | `not-found`            | Resource doesn't exist or is soft-deleted                              |
| 409    | `conflict`             | e.g. username/email already taken, self-follow attempt                 |
| 413    | `payload-too-large`    | Media exceeds size limit at presign time                               |
| 422    | `media-not-ready`      | Attaching a `PENDING`/`FAILED` media id to a post/avatar               |
| 429    | `rate-limited`         | Throttler rejection                                                    |
| 500    | `internal-error`       | Unhandled exception (never leaks internals in `detail`)                |

## 15. Client Codegen Workflow (implemented Milestone 6)

1. `nx run api:generate-openapi` builds the same OpenAPI document `@nestjs/swagger` +
   `nestjs-zod`'s `cleanupOpenApiDoc` produce for the live `/api/docs-json` endpoint
   (§16), but writes it to a real, gitignored build artifact — `apps/api/openapi.json`
   — **without booting an HTTP listener**. It uses `NestFactory.create(AppModule,
{ abortOnError: false })`: the document only reads controller/DTO metadata
   assembled during module compilation, before any lifecycle hook runs, so it doesn't
   need `PrismaService`'s live `$connect()` to have succeeded — verified empirically by
   running it against a deliberately-unreachable `DATABASE_URL`. `main.ts` does **not**
   use this flag; a real server should still fail fast on bad DB connectivity.
2. `nx run api-client:generate-types` (`dependsOn: ["api:generate-openapi"]`) runs
   `openapi-typescript` against that file to produce request/response **types** at
   `packages/api-client/src/generated/openapi-types.ts` (also gitignored — a build
   artifact, not a file to keep in sync by hand, same as `prisma/generated/`).
   `api-client:build` depends on this target, satisfying the letter of the original
   "`api-client:build` depends on `api:build`" risk-#2 mitigation via an intermediate
   target rather than the literal name — webpack-bundling `apps/api` first isn't
   actually needed to introspect its routes, and skipping it keeps this step fast.
3. The hand-written transport layer in `packages/api-client` (`HttpClient`: fetch
   wrapper, auth-refresh interceptor with retry-once-on-401, Problem Details error
   unwrapping) is typed against **`packages/validation`'s existing Zod-inferred types**
   (`RegisterInput`, `AuthResponse`, etc.), not step 2's generated ones — both describe
   the same shapes since the OpenAPI doc is itself derived from those same Zod schemas
   via `nestjs-zod`, so typing the client against the generated copy a second time would
   duplicate types for zero benefit (`web`/`mobile` already depend on
   `packages/validation` directly per §6's package table). The generated types still
   earn their keep as a compile-time contract check instead
   (`packages/api-client/src/lib/openapi-contract.spec.ts`): if `apps/api` ever stops
   serving a route this client wraps, that file fails to typecheck.
4. Both `web` and `mobile` import only from `packages/api-client` for calls **to the
   API** — no app makes a raw `fetch` call to an API route directly, which keeps
   auth-refresh and error handling consistent everywhere. One namespace per resource:
   `apiClient.auth.*` (register/login/logout/session, Milestone 5), `apiClient.users.*`
   (getProfile/getPosts/updateProfile/updateAvatar, Milestones 8–9), and
   `apiClient.media.*` (presign/complete/getById/waitUntilProcessed, Milestone 9) exist
   so far — more are added as the endpoints they wrap land. `getProfile`/`getPosts` use
   a third `HttpClient` call shape, `optionallyAuthorizedRequest` (attaches a token if
   one exists, never requires one), mirroring the API's own `OptionalAuthGuard`. The one
   deliberate exception to "no raw `fetch`": the actual direct-to-bucket upload
   (`docs/ARCHITECTURE.md` §8 point 2, `MediaClient.uploadToPresignedUrl`) — that `PUT`
   goes straight to the storage provider, never through the API, so it's not a call
   "to the API" in the first place.

## 16. Health & OpenAPI (implemented Milestone 4)

| Method & path        | Auth | Response                                                                                                                   |
| -------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health` | none | `200` → `{ status: 'ok', database: 'up' }`. `503` (Problem Details, `service-unavailable`) if the database is unreachable. |

Not versioned/prefixed like the rest of the API by convention — it just happens to
also land under `/api/v1` because URI versioning and the global prefix apply
workspace-wide (`docs/ARCHITECTURE.md` §5.2) — but a health check is infrastructure,
not a resource, and isn't listed as a feature in `docs/FEATURES.md`.

`GET /api/docs` (interactive Swagger UI) and `GET /api/docs-json` (the raw OpenAPI
document) are also live, gated to non-production via `NODE_ENV` — see §15.
