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
- **Rate limiting**: `@nestjs/throttler` (Redis-backed) applied globally (e.g. 100
  req/min/IP) with stricter per-route limits on `/auth/*` (e.g. 10 req/min/IP on
  login/register) to slow credential-stuffing/enumeration.
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

| Method & path         | Auth\*                                                     | Body                                                              | Response                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/register` | none                                                       | `RegisterInputSchema`: `{ email, username, password, fullName? }` | `201` → `AuthResponseSchema`: `{ user, accessToken, accessTokenExpiresAt, refreshToken? }` + sets the refresh cookie (web)                                                            |
| `POST /auth/login`    | none                                                       | `LoginInputSchema`: `{ emailOrUsername, password }`               | `200` → `AuthResponseSchema` (same shape as register)                                                                                                                                 |
| `POST /auth/refresh`  | refresh cookie (web) or `RefreshInputSchema` body (mobile) | `RefreshInputSchema`: `{ refreshToken? }`                         | `200` → `RefreshResponseSchema`: `{ accessToken, accessTokenExpiresAt, refreshToken? }`, rotated cookie (web). `401` + full family revocation if a reused/expired token is presented. |
| `POST /auth/logout`   | refresh cookie (web) or `LogoutInputSchema` body (mobile)  | `LogoutInputSchema`: `{ refreshToken?, allDevices? }`             | `204` — revokes the presented token's family (or all of the user's families if `allDevices`)                                                                                          |
| `GET /auth/session`   | access token                                               | —                                                                 | `200` → `SessionResponseSchema`: `{ user }` — cheap "am I logged in / who am I" check used by SSR                                                                                     |

\* `refreshToken` is optional in `RefreshInputSchema`/`LogoutInputSchema` because it's
only ever sent by mobile clients — web relies on the httpOnly cookie exclusively and
sends no body at all for these two routes. `AuthResponseSchema`/`RefreshResponseSchema`
mirror this: `refreshToken` is present in the response body only for mobile.

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

## 4. Users & Profiles

| Method & path                | Auth     | Notes                                                                                                            |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /users/:username`       | optional | Public profile: bio, avatar, post/follower/following counts, `isFollowedByMe` (only computed when authenticated) |
| `GET /users/:username/posts` | optional | Paginated post grid for that user                                                                                |
| `PATCH /me`                  | required | Update own profile (`fullName`, `bio`, `websiteUrl`, `isPrivate`) — also see §10 (settings)                      |
| `PATCH /me/avatar`           | required | Body `{ mediaId }` — must reference the caller's own `READY` `AVATAR`-purpose media                              |
| `DELETE /me`                 | required | Soft-deletes the account (sets `deletedAt`); revokes all refresh token families                                  |

## 5. Follows

| Method & path                    | Auth     | Notes                                                         |
| -------------------------------- | -------- | ------------------------------------------------------------- |
| `PUT /users/:username/follow`    | required | Idempotent follow; `204`. `409` if attempting to follow self. |
| `DELETE /users/:username/follow` | required | Idempotent unfollow; `204`                                    |
| `GET /users/:username/followers` | optional | Paginated                                                     |
| `GET /users/:username/following` | optional | Paginated                                                     |

No approval/request step in the MVP even for `isPrivate` accounts — see
`FEATURES.md` for the explicit scope decision and `DATABASE.md` §3.6.

## 6. Media

| Method & path              | Auth     | Notes                                                                                                                                                                                                                    |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /media/presign`      | required | Body `{ purpose: 'AVATAR'\|'POST_IMAGE', contentType, byteSize }` → `{ mediaId, uploadUrl, expiresAt }`. Server enforces size/type limits (e.g. ≤ 8 MB, `image/jpeg`\|`image/png`\|`image/webp`) before issuing the URL. |
| `POST /media/:id/complete` | required | Confirms the upload exists in the bucket, sets `status: PENDING → (queued for processing)`, enqueues the variant-generation job                                                                                          |
| `GET /media/:id`           | required | Poll processing status: `{ status, variants? }` — used by clients to know when a just-uploaded image is ready to attach to a post                                                                                        |

## 7. Posts

| Method & path       | Auth                   | Notes                                                                                                                                                                                            |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /posts`       | required               | Body `{ caption?, location?, mediaIds: string[] }` (1–10 items, order = array order); all `mediaIds` must be the caller's own `READY`, `POST_IMAGE`-purpose media not already attached elsewhere |
| `GET /posts/:id`    | optional               | Single post with author, media (ordered), counts, `isLikedByMe`/`isSavedByMe` when authenticated                                                                                                 |
| `DELETE /posts/:id` | required (author only) | Soft delete                                                                                                                                                                                      |
| `GET /feed`         | required               | The authenticated home feed — paginated posts from followed accounts, newest first (see `DATABASE.md` §6)                                                                                        |

## 8. Likes

| Method & path                | Auth     | Notes                                      |
| ---------------------------- | -------- | ------------------------------------------ |
| `PUT /posts/:postId/like`    | required | Idempotent like; `204`                     |
| `DELETE /posts/:postId/like` | required | Idempotent unlike; `204`                   |
| `GET /posts/:postId/likes`   | optional | Paginated list of users who liked the post |

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

## 15. Client Codegen Workflow

1. `apps/api`, at boot, generates the OpenAPI document (`@nestjs/swagger` +
   `nestjs-zod`'s `cleanupOpenApiDoc`, wired in Milestone 4 — see §16) and serves it
   at `/api/docs-json`. **Not yet** a literal Nx build-output file (`openapi.json` on
   disk, produced by `api:build` without booting the server) — that's deferred to
   Milestone 6, once `packages/api-client`'s actual consumption contract (does it fetch
   from a running server, or read a committed file?) is decided alongside it.
2. `packages/api-client`'s `build` target (`dependsOn: ["api:build"]`) runs
   `openapi-typescript` against that spec to produce request/response **types**.
3. The hand-written transport layer in `packages/api-client` (fetch wrapper, auth-refresh
   interceptor, pagination cursor helpers, Problem Details error unwrapping) is typed
   against those generated types — one method per endpoint listed above, e.g.
   `apiClient.posts.create(input)`, `apiClient.follows.follow(username)`.
4. Both `web` and `mobile` import only from `packages/api-client` — no app makes a raw
   `fetch` call to the API directly, which keeps auth-refresh and error handling
   consistent everywhere.

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
