# Implementation Plan

Breaks the MVP into milestones that can each be implemented, tested, and committed
independently. **Nothing in this plan has been implemented yet** — this is the sequencing
document for when implementation begins.

## Principles

1. **Each milestone ends in a working, tested, committable state.** No milestone leaves
   the repo in a state where `nx affected -t lint test build` fails.
2. **Vertical before horizontal where possible**: once auth exists, each feature
   milestone delivers schema → API → web UI → mobile UI for one feature, rather than
   "all backends, then all frontends" — this surfaces integration problems (e.g. in the
   `api-client` codegen pipeline) early and repeatedly, instead of once at the end.
3. **Infrastructure milestones (0–5) are the exception** — they're necessarily
   horizontal, because nothing else can start without a workspace, database, and auth.
4. **One Prisma migration per milestone** that changes the schema (see
   `DATABASE.md` §8), named after the milestone.
5. **Every milestone that introduces a framework/library confirms current versions
   against that framework's official docs first** (`ARCHITECTURE.md` risk #9) — the
   version table in `ARCHITECTURE.md` is a starting point, not a pin.
6. **Definition of Done** (applies to every milestone unless noted otherwise):
   - `nx affected -t lint test build` passes.
   - New/changed behavior has unit and, where it crosses the HTTP boundary, API
     integration test coverage.
   - `packages/validation` schemas exist for any new request/response shape before the
     controller/UI code that uses them (schema-first).
   - Docs (`API.md`/`DATABASE.md`/`FEATURES.md`) updated in the same commit if the
     milestone deviates from what they currently say.
   - One commit (or a small, clearly-sequenced stack) per milestone; commit message
     references the milestone number.

## Dependency Graph (high level)

```
M0 Workspace ─▶ M1 Docker infra ─▶ M2 Prisma base ─▶ M3 Shared types/validation base
                                        │                        │
                                        ▼                        ▼
                                  M4 API bootstrap ◀──────────────┘
                                        │
                                        ▼
                                  M5 Auth (API)
                                   │        │
                                   ▼        ▼
                          M6 Web bootstrap  M7 Mobile bootstrap
                          + auth UI          + auth UI
                                   │        │
                                   └───┬────┘
                                       ▼
                         M8 Profiles + avatar upload (needs M9's media groundwork*)
                                       │
                     ┌─────────────────┼─────────────────┐
                     ▼                 ▼                 ▼
              M9 Media pipeline  M10 Follow/unfollow  (parallelizable once M8 lands)
                     │
                     ▼
              M11 Posts (create/read/delete)
                     │
                     ▼
              M12 Home feed
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   M13 Likes   M14 Comments   M15 Saved posts
        │            │            │
        └────────────┴─────┬──────┘
                            ▼
                     M16 Notifications
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      M17 User search              M18 Explore page
              │                           │
              └─────────────┬─────────────┘
                             ▼
                     M19 Account settings
                             │
                             ▼
                   M20 Web E2E + hardening pass
```

*Note on M8/M9 ordering: profile *viewing\* doesn't need media, but "profile photo
upload" (Feature 4) does, so M9 (the generic media pipeline) is scheduled immediately
after M8's read-only profile work and before avatar upload is wired into the UI — see
M8/M9 below for the precise split.

## Milestones

### M0 — Workspace Bootstrap

- Create the Nx workspace with `--packageManager=pnpm`; set up `pnpm-workspace.yaml`,
  `tsconfig.base.json` (strict mode), root `.npmrc` (`engine-strict=true`).
- `packages/eslint-config`: shared flat ESLint config + Prettier config.
- Configure Nx module boundary tags (`scope:*`, `type:*`) and the
  `@nx/enforce-module-boundaries` lint rule (`ARCHITECTURE.md` §3.2) — **before any app
  exists**, so every app generated afterward is tagged correctly from creation.
- `CLAUDE.md` documents the pnpm-only rule, workspace layout, and module boundary rules
  for future contributors (human or AI).
- No apps yet. **Tests**: a placeholder lint/test target passes; boundary rule verified
  with a throwaway pair of dummy projects, then removed.
- **Risk touched**: #8 (boundaries from commit one).

### M1 — Local Infrastructure (Docker Compose)

- `docker-compose.yml`: `postgres:17`, `minio` (+ bucket-init container), `redis:7`,
  `maildev`.
- `.env.example` documenting every variable; root `README.md` "getting started" section
  (start infra, run migrations, run apps).
- **Tests**: a smoke script (or documented manual step) confirming all four services
  come up healthy; not yet wired into any app.

### M2 — Prisma Base Schema

- `prisma/` project wired into Nx with `generate`/`migrate` targets; confirm Prisma 7's
  current config approach (`prisma.config.ts`, driver adapters) against Prisma's docs
  first (`ARCHITECTURE.md` risk #1).
- Enable `citext`, `pgcrypto`, `pg_trgm` extensions (`DATABASE.md` §5).
- Schema: `User`, `RefreshToken` only (everything auth needs) — first migration
  `0001_init_user_auth`.
- `prisma/seed.ts` skeleton (seeds a couple of test users).
- **Tests**: migration applies cleanly to a fresh DB in CI-like conditions
  (`migrate deploy` against the Compose Postgres); seed script runs without error.

### M3 — Shared Types & Validation (Base)

- `packages/types`: base primitives (`Cursor`, `PaginatedResponse<T>`, ID branding if
  used).
- `packages/validation`: `RegisterInputSchema`, `LoginInputSchema`,
  `UserResponseSchema` and friends for auth only, at this stage.
- `packages/config`: `loadEnv()` + `ApiEnvSchema` (DB URL, JWT keys, Redis URL, S3
  config, etc.).
- **Tests**: unit tests for each schema's accept/reject cases; `loadEnv()` throws a
  readable error on a missing/invalid var (tested by intentionally breaking one).

### M4 — API Bootstrap

- `apps/api` generated via `@nx/nest`, tagged `scope:api`.
- Wires `ConfigModule` (via `packages/config`), `PrismaModule` (DI-provided client),
  global `ZodValidationPipe`, global RFC 7807 exception filter, `helmet`, CORS config,
  URI versioning (`/api/v1`), health check endpoint (`GET /api/v1/health`).
- `@nestjs/swagger` wired to emit `openapi.json` as a build artifact, served at
  `/api/docs`.
- **Tests**: API integration test for `/health` via Supertest against a real (migrated)
  test database (`apps/api-e2e` created here).

### M5 — Authentication

- `AuthModule`: register, login, refresh (with rotation + reuse-detection, per
  `ARCHITECTURE.md` §7), logout, session endpoints, per `API.md` §3.
- Argon2id password hashing; JWT access tokens with `tokenVersion` claim.
- Throttler applied to `/auth/*`.
- **Tests**:
  - Unit: password hashing, JWT issuance/verification, rotation logic (including the
    reuse-detection branch — a rotated-away token being replayed must revoke the whole
    family).
  - Integration: full register → login → refresh → logout HTTP flows; expired-token and
    reused-token-family-revocation scenarios.
- **Risk touched**: none new, but this is where risk #1's Prisma decisions get
  exercised for real for the first time under load-bearing code.

### M6 — Web Bootstrap + Auth UI

- `apps/web` generated via `@nx/next` (App Router, Next 16), tagged `scope:web`.
- `packages/api-client` created here: the OpenAPI-codegen pipeline (`ARCHITECTURE.md`
  §6.2, `API.md` §15) is stood up and proven end-to-end for exactly the auth endpoints
  that exist so far — this is the milestone that validates risk #2 (build-order
  dependency) before any other feature leans on it.
  - `api-client`'s storage-adapter interface (risk #5) is designed here even though
    only the web (cookie) adapter is implemented yet; the mobile adapter's shape is
    agreed so M7 doesn't need to change the interface.
- Web auth pages: register, login, logout action, minimal authenticated shell (a stub
  "home" route behind an auth check) using Server Actions calling `api-client`.
- **Tests**: unit tests for `api-client`'s fetch/refresh-retry logic (mocked HTTP);
  first Playwright test (`apps/web-e2e` created here) covering register → login → land
  on the authenticated shell → logout.

### M7 — Mobile Bootstrap + Auth UI

- `apps/mobile` generated via `@nx/expo` (Expo Router), tagged `scope:mobile`.
- Implements the SecureStore storage adapter for `api-client` designed in M6.
- Mobile auth screens: register, login, logout, minimal authenticated tab shell.
- **Tests**: Jest + React Native Testing Library unit tests for the auth screens/forms
  and the SecureStore adapter (mocked SecureStore).

### M8 — User Profiles (read + edit, no photo upload yet)

- API: `GET /users/:username`, `GET /users/:username/posts` (returns empty until M11),
  `PATCH /me`.
- Web + mobile: profile view screen, edit-profile form (name/bio/website/isPrivate
  toggle — toggle is inert per `FEATURES.md` #17 scope note, but present).
- **Tests**: integration tests for profile read/update, including that a private-field
  update from a non-owner is rejected (403); Playwright covers viewing + editing own
  profile.

### M9 — Media Pipeline

- Schema: `Media` table — migration `000x_media`.
- API: `POST /media/presign`, `POST /media/:id/complete`, `GET /media/:id`
  (`API.md` §6); S3 client wired to MinIO locally; BullMQ + Redis wired (this is the
  first milestone that uses the job queue).
- Background processor: `sharp`-based variant generation (thumbnail/feed sizes),
  blurhash generation.
- Web + mobile: reusable image-picker → presign → upload → poll-until-ready flow (shared
  logic where feasible, platform-specific picker UI).
- Wire `PATCH /me/avatar` and profile UI's "change photo" affordance (completes
  Feature 4).
- **Tests**: integration test for the full presign→complete→(job runs synchronously in
  test mode or awaited)→`READY` flow against real MinIO/Redis in Compose; unit tests for
  the variant-generation function in isolation (given a fixed input image, expected
  output dimensions).
- **Risk touched**: #4 (in-process job runner — explicitly accepted here for MVP scope;
  the processor is written as an isolated provider per the mitigation).

### M10 — Follow / Unfollow

- Schema: `Follow` table — migration.
- API: `PUT`/`DELETE /users/:username/follow`, `GET /users/:username/followers`,
  `GET /users/:username/following` (`API.md` §5).
- Web + mobile: follow button on profile, followers/following list screens.
- **Tests**: integration tests including idempotency (following twice is a no-op
  `204`), self-follow rejection, and follower/following count correctness; Playwright
  covers following a user from their profile and seeing it reflected in a followers
  list.

### M11 — Posts (Create, Read, Delete)

- Schema: `Post`, `PostMedia` — migration.
- API: `POST /posts`, `GET /posts/:id`, `DELETE /posts/:id` (`API.md` §7).
- Web + mobile: create-post flow (multi-image select using M9's upload flow, caption
  input, location text), post detail view, profile grid now shows real posts (completes
  the M8 stub).
- **Tests**: integration tests for multi-image post creation (including the
  media-must-be-`READY`-and-owned-by-caller validation, and the 1–10 image bound);
  Playwright covers creating a post with 2+ images and viewing it on the profile grid.
- **Risk touched**: #9 confirms Next 16 image-handling APIs at this point since this is
  the first milestone rendering uploaded media through `next/image`.

### M12 — Home Feed

- API: `GET /feed` (`API.md` §7) implementing the fan-out-on-read query
  (`DATABASE.md` §6) with cursor pagination.
- Web + mobile: feed screen (infinite scroll / load-more via cursor).
- **Tests**: integration test seeding a follow graph and posts, asserting feed
  ordering/pagination correctness and that non-followed accounts' posts are excluded;
  a basic query-plan sanity check (e.g. `EXPLAIN` shows index usage) documented as a
  manual/CI-script step, not a unit test.
- **Risk touched**: #3 — this is where the fan-out-on-read decision is actually
  exercised; if seeded-data query performance is surprising, that's the signal to revisit
  the risk register entry, not to silently change approach mid-milestone.

### M13 — Likes

- Schema: `Like` — migration.
- API + web/mobile UI: `API.md` §8.
- Notification side-effect stubbed as a direct write for now (`Notification` table
  doesn't exist until M16); tracked as a TODO resolved in M16, or M13 can enqueue into a
  BullMQ job whose consumer is only implemented in M16 — pick whichever keeps M13
  shippable alone; **recommended**: implement M16's `Notification` table and enqueue
  mechanism as part of M13 itself if that's simpler than a half-built stub, since
  `DATABASE.md`/`FEATURES.md` already fully specify it — otherwise keep the like feature
  functionally complete without notifications and add them in M16. Document whichever
  choice is made in this milestone's PR.
- **Tests**: integration tests for like/unlike idempotency, like count correctness,
  liker list pagination; Playwright covers liking a post from the feed.

### M14 — Comments

- Schema: `Comment` — migration.
- API + web/mobile UI: `API.md` §9 (flat comments only, per `FEATURES.md` #12).
- **Tests**: integration tests for create/list/delete (including the
  author-or-post-author delete permission check); Playwright covers commenting on a
  post.

### M15 — Saved Posts

- Schema: `SavedPost` — migration.
- API + web/mobile UI: `API.md` §10.
- **Tests**: integration tests for save/unsave idempotency and the saved-list endpoint;
  Playwright covers saving a post and finding it in the saved list.

### M16 — Notifications

- Schema: `Notification` — migration (if not already created in M13, per that
  milestone's note).
- Wire like/comment/follow event producers (BullMQ) → notification-creation consumer.
- API + web/mobile UI: `API.md` §12 (list, unread count, mark-read); polling interval on
  clients for the badge count.
- **Tests**: integration test that liking/commenting/following another user produces
  the expected notification row (via the job queue, awaited in test mode) and that
  self-actions (liking your own post) don't; Playwright covers seeing a notification
  after another test user's action (via API-seeded setup, not two real browser
  sessions).

### M17 — User Search

- API: `GET /search/users?q=` (`pg_trgm`, `API.md` §11).
- Web + mobile: search UI with debounced input.
- **Tests**: integration tests for ranking/matching behavior on seeded usernames
  (including partial/typo matches given trigram similarity); Playwright covers finding
  and navigating to a user via search.

### M18 — Explore Page

- API: `GET /explore` (`API.md` §11) — recency+engagement heuristic query.
- Web + mobile: explore grid UI.
- **Tests**: integration test asserting followed-accounts' posts are excluded and
  ranking is stable/deterministic for a fixed seed; Playwright smoke test for the page
  loading with content.

### M19 — Account Settings

- API: `POST /me/change-password` (with `tokenVersion` bump), `POST /me/change-email`,
  `DELETE /me` (soft delete + full session revocation) — `API.md` §13.
- Web + mobile: settings screens.
- **Tests**: integration tests confirming a password change invalidates other sessions'
  access tokens (via `tokenVersion` mismatch) while the changing session's _new_ token
  still works; account deletion integration test confirming soft-deleted users
  disappear from public reads (profile, search) but rows remain in the DB.

### M20 — Web E2E Coverage + Hardening Pass

- Expand `apps/web-e2e` Playwright coverage to the full critical-path list explicitly
  (register → login → edit profile → upload avatar → follow another user → create a
  multi-image post → appear in follower's feed → like → comment → save → appear in
  search → appear in explore → receive + read a notification → change password →
  log out).
- Security/hardening review pass against `ARCHITECTURE.md` §11 checklist (headers,
  CORS, rate limits actually effective under test, no secrets in client bundles).
- Confirm every entry in the risk register (`ARCHITECTURE.md` §12) that was "deferred"
  is still an acceptable trade-off given what was actually built, and note any that
  need to be revisited before real users are onboarded.
- CI pipeline finalized: `nx affected -t lint test build e2e` gating merges.
- This milestone is the natural point to write a `docs/PROGRESS.md` entry (per the
  project's documented `docs/` structure) summarizing what shipped against this plan,
  and to decide which future feature (Stories, Reels, DMs, push, realtime) is tackled
  next.

## Summary Table

| #   | Milestone                    | New tables             | New packages/apps touched first |
| --- | ---------------------------- | ---------------------- | ------------------------------- |
| 0   | Workspace bootstrap          | —                      | `eslint-config`                 |
| 1   | Docker infra                 | —                      | —                               |
| 2   | Prisma base                  | `User`, `RefreshToken` | `prisma`                        |
| 3   | Shared types/validation base | —                      | `types`, `validation`, `config` |
| 4   | API bootstrap                | —                      | `api`                           |
| 5   | Auth                         | —                      | —                               |
| 6   | Web bootstrap + auth UI      | —                      | `web`, `api-client`, `web-e2e`  |
| 7   | Mobile bootstrap + auth UI   | —                      | `mobile`                        |
| 8   | Profiles (read/edit)         | —                      | —                               |
| 9   | Media pipeline               | `Media`                | —                               |
| 10  | Follow/unfollow              | `Follow`               | —                               |
| 11  | Posts                        | `Post`, `PostMedia`    | —                               |
| 12  | Home feed                    | —                      | —                               |
| 13  | Likes                        | `Like`                 | —                               |
| 14  | Comments                     | `Comment`              | —                               |
| 15  | Saved posts                  | `SavedPost`            | —                               |
| 16  | Notifications                | `Notification`         | —                               |
| 17  | User search                  | —                      | —                               |
| 18  | Explore page                 | —                      | —                               |
| 19  | Account settings             | —                      | —                               |
| 20  | E2E coverage + hardening     | —                      | —                               |
