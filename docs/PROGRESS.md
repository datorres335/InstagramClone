# Project Progress

This file tracks the current implementation status of the Instagram clone.

It should be updated after every completed milestone or meaningful development session.

---

## Current Status

**Phase:** Infrastructure
**Current Milestone:** Milestone 5 — Authentication
**Status:** Complete

The Nx/pnpm monorepo, all three application shells (web, api, mobile), the five
shared packages, the Prisma toolchain, and local Docker infrastructure are all
scaffolded and passing validation (Milestone 0, with Docker infra/Milestone 1 landing
as a side effect of it). The first real database models — `User` and `RefreshToken` —
are implemented, migrated, and seeded (Milestone 2). `packages/types` and
`packages/validation` carry real, tested content for everything auth needs
(Milestone 3). `apps/api` has a real DI graph — a Prisma-backed database connection, a
global Zod validation pipe, an RFC 7807 error format, and live OpenAPI docs — proven by
a real `GET /api/v1/health` endpoint (Milestone 4). `apps/api` now has its first real
_feature_ module: `AuthModule` implements all five `docs/API.md` §3 endpoints
(register/login/refresh/logout/session) against real HTTP traffic and the live
Postgres — `argon2id` password hashing, JWT access tokens carrying a `tokenVersion`
claim, opaque refresh tokens with rotation + reuse-detection family revocation, and
`@nestjs/throttler` on the credential-facing routes (Milestone 5). The three seed users
(`alice`/`bob`/`carol`, Milestone 2) are now actually log-in-able. No other product
feature endpoints exist yet (posts/follows/etc.) — those start with Milestone 6 onward.

---

## Completed

### Planning Documents

- [x] `docs/ARCHITECTURE.md`
- [x] `docs/FEATURES.md`
- [x] `docs/DATABASE.md`
- [x] `docs/API.md`
- [x] `docs/IMPLEMENTATION_PLAN.md`
- [x] `docs/PROGRESS.md`

### Milestone 0 — Project Scaffolding

- [x] Git repository initialized (`main` branch, no commits yet as of this writing)
- [x] pnpm workspace (`pnpm-workspace.yaml`) + pnpm 12.6.0 pinned via `package.json#packageManager`
- [x] Nx workspace (`nx.json`, v23.2.1) with module-boundary lint rules enforced from the start
- [x] `tsconfig.base.json` — strict TypeScript for the whole repo
- [x] Shared ESLint flat config (`packages/eslint-config`) + Prettier, wired into every project
- [x] `apps/web` — Next.js 16.3.6, App Router, Turbopack dev/start, Vitest unit tests, Playwright e2e (`apps/web-e2e`)
- [x] `apps/api` — NestJS 11.2.5, webpack build (Node target), Jest unit + integration tests (`apps/api-e2e`)
- [x] `apps/mobile` — Expo SDK 56 + Expo Router, Jest + React Native Testing Library
- [x] `packages/types`, `packages/validation`, `packages/api-client` — scaffolded, buildable, tested (placeholder content; real shapes land with the features that need them)
- [x] `packages/config` — real, working env-schema + `loadEnv()` (Zod 4), consumed by `apps/api` at startup
- [x] `prisma/` — Prisma 7.10.0, `prisma.config.ts`, empty schema wired to the Dockerized Postgres, `generate`/`migrate-*`/`studio`/`db-seed` Nx targets
- [x] `docker-compose.yml` — Postgres 17, Redis 7, MinIO (via quay.io), Maildev
- [x] `.env.example` / `.env` — env vars for every service, validated by `packages/config`
- [x] Full validation passing: `nx run-many -t lint test build` (11/11 projects), `api-e2e:e2e`, `web-e2e:e2e`

### Milestone 2 — Prisma Base Schema

- [x] `prisma/schema.prisma` — `User` and `RefreshToken` models (`docs/DATABASE.md`
      §3.1–3.2), `citext` extension, UUIDv7 primary keys via `@default(uuid(7))`
- [x] `prisma/tsconfig.json` + a `prisma:typecheck` Nx target — `seed.ts` is now
      typechecked, closing a gap where nothing did (`generate` just runs the CLI)
- [x] First migration, `prisma/migrations/20260924043452_0001_init_user_auth/` —
      hand-added `CREATE EXTENSION IF NOT EXISTS citext;` ahead of the generated
      `CREATE TABLE` statements (Prisma's schema DSL enables the extension via the
      native type annotation but doesn't emit the `CREATE EXTENSION` itself)
- [x] Applied to the Dockerized Postgres; verified with `\d users` / `\d refresh_tokens`
      that the live schema matches `docs/DATABASE.md` exactly
- [x] `prisma/seed.ts` — seeds 3 real users (`alice`, `bob` [private], `carol`) with
      real `argon2id` password hashes (dev password `Password123!` for all three),
      idempotent via `upsert` (re-running does not duplicate or error)
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) — this milestone is the first to exercise the `typecheck` target

### Milestone 3 — Shared Types & Validation (Base)

- [x] `packages/types`: `Cursor` (plain string alias) and `PaginatedResponse<TItem>`
      (`docs/API.md` §1's `{ data, meta.nextCursor }` envelope) — replaces the
      placeholder content the package carried since Milestone 0
- [x] `packages/validation`: `usernameSchema` and `userResponseSchema` (`src/lib/user.ts`);
      `passwordSchema`, `registerInputSchema`, `loginInputSchema`, `refreshInputSchema`,
      `logoutInputSchema`, `authResponseSchema`, `refreshResponseSchema`,
      `sessionResponseSchema` (`src/lib/auth.ts`) — every request/response shape
      `docs/API.md` §3 (Auth) documents, replacing the placeholder content
- [x] `zod` added as a real dependency of `packages/validation` (was scaffolded but
      unused since Milestone 0)
- [x] `packages/config` needed no changes — its `apiEnvSchema` already covered DB URL,
      JWT keys, Redis URL, and S3 config since Milestone 0, and `loadEnv()`'s
      missing/invalid-var test already existed
- [x] 36 new unit tests (`user.spec.ts`, `auth.spec.ts`) covering every schema's
      accept/reject cases, plus 2 for `packages/types`' `PaginatedResponse` shape
- [x] `docs/API.md` §3 tightened to mirror the schemas exactly, resolving an ambiguity
      the original draft left open (see "Architectural Decisions Made" below)
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11 projects)

### Milestone 4 — API Bootstrap

- [x] `apps/api/src/config/config.module.ts` — a `@Global()` `ConfigModule` providing
      the validated env via an `API_ENV` DI token, so services inject config instead
      of each re-parsing `process.env` (`main.ts` still calls `loadEnv()` directly too,
      for bootstrap-time concerns like port/CORS that run before the DI container exists)
- [x] `apps/api/src/prisma/{prisma.service,prisma.module}.ts` — a `@Global()`
      `PrismaModule`; `PrismaService extends` the generated `@instagram-clone/
  prisma-client` (a new tsconfig path alias, `tsconfig.base.json`), wired to
      `@prisma/adapter-pg`, connects/disconnects via `OnModuleInit`/`OnModuleDestroy`
- [x] `apps/api/src/common/filters/http-exception.filter.ts` — a global `@Catch()`
      filter (registered via `APP_FILTER`) turning `ZodValidationException`, any Nest
      `HttpException`, and unhandled errors alike into the RFC 7807 shape `docs/API.md`
      §1 specifies, with a status→slug map for the `docs/API.md` §14 error catalog
- [x] Global `ZodValidationPipe` (`nestjs-zod`, registered via `APP_PIPE`) — validates
      `createZodDto`-wrapped `packages/validation` schemas; not exercised by a real
      endpoint yet (no controller has a body/query DTO until Milestone 5), proven
      instead by a direct unit test against a real Milestone 3 schema
      (`common/zod-dto-integration.spec.ts`)
- [x] `@nestjs/swagger` + `nestjs-zod`'s `cleanupOpenApiDoc` wired in `main.ts` —
      `GET /api/docs` (interactive UI) and `GET /api/docs-json` (raw document), both
      gated to non-production
- [x] `GET /api/v1/health` (`apps/api/src/health/`) — a real "deep" check: queries
      Postgres via the new `PrismaService` (`SELECT 1`), returns `503` (via the new
      exception filter) if the database is unreachable, not just "is the process alive"
- [x] Removed the Milestone-0 placeholder `AppController`/`AppService` (`GET /api/v1`
      → `{ message: 'Hello API' }`) now that a real endpoint exists
- [x] `express`, `@types/express`, and `zod` added as explicit `apps/api` dependencies
      (previously phantom/transitive — pnpm's strict `node_modules` correctly refused
      to resolve them until declared); `nestjs-zod@5.5.0` and `@nestjs/swagger@11.4.7`
      added, pinned to the NestJS-11-compatible line (see Deviations below)
- [x] `apps/api`'s `build`/`test` targets now explicitly `dependsOn` `prisma:generate`
      (`implicitDependencies: ["prisma"]` + per-target `dependsOn` in `project.json`) —
      confirmed this actually orders the task graph correctly, not just declared
- [x] 13 new unit tests (`http-exception.filter.spec.ts`, `health.service.spec.ts`,
      `zod-dto-integration.spec.ts`) + 4 new `apps/api-e2e` integration tests
      (`health.spec.ts`, `openapi.spec.ts`, `problem-details.spec.ts`) against the real
      Dockerized Postgres and a real running Nest server
- [x] `docs/API.md` gained §16 (Health & OpenAPI) and a corrected §15 (the actual
      `cleanupOpenApiDoc` API, and that `openapi.json`-as-a-build-artifact is deferred
      to Milestone 6); `docs/ARCHITECTURE.md` §5.2 corrected to match
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) + `api-e2e:e2e` (4/4) against the live Dockerized Postgres

### Milestone 5 — Authentication

- [x] `apps/api/src/modules/auth/` — the first domain module (`docs/ARCHITECTURE.md`
      §5.2's directory convention): `auth.controller.ts`, `auth.service.ts`,
      `tokens.service.ts`, `password.service.ts`, `jwt-auth.guard.ts`, plus small
      single-purpose files (`auth.dto.ts`, `auth.exceptions.ts`, `jwt-payload.ts`,
      `current-user.decorator.ts`, `refresh-cookie.ts`, `request-meta.ts`,
      `user-response.mapper.ts`)
- [x] All five `docs/API.md` §3 endpoints, wired to Milestone 3's Zod schemas via
      `createZodDto`: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
      `POST /auth/logout`, `GET /auth/session`
- [x] `PasswordService` — `argon2id` hashing/verification (`argon2`, already a
      dependency since Milestone 2's `prisma/seed.ts`)
- [x] `TokensService` — issues JWT access tokens (`{ sub, tokenVersion }` payload, 15m
      TTL) and opaque refresh tokens (32 random bytes, SHA-256-hashed at rest, 30d TTL,
      per `docs/DATABASE.md` §3.2's `RefreshToken` fields); `rotate()` implements
      rotation-with-reuse-detection exactly as `docs/ARCHITECTURE.md` §7 specifies —
      an unknown or naturally-expired token is a plain `401`, but a token that's
      already been rotated away (`revokedAt` set) triggers full `familyId` revocation
      plus a distinct `refresh-token-reused` error type
- [x] `JwtAuthGuard` — a small custom guard (no `@nestjs/passport`/`passport-jwt`,
      since there's only one auth strategy) that verifies the JWT, re-checks the user
      still exists/isn't soft-deleted, and compares `tokenVersion` against the current
      DB value so a password change (or any future "log out everywhere") invalidates
      already-issued access tokens without an allowlist
- [x] Timing-safe login: a wrong password and a nonexistent user both take the
      `argon2.verify` path (against a fixed dummy hash when no user is found) and
      return the identical generic `401`, closing the username-enumeration
      timing/response side-channel
- [x] `HttpProblemException` (`apps/api/src/common/exceptions/`) — a small base class
      letting a domain module attach its own RFC 7807 `type`/`title` (e.g.
      `refresh-token-reused`) without `common/`'s exception filter importing from
      domain modules; `HttpExceptionFilter` and its tests updated to check for it
      ahead of the generic `HttpException` status→slug mapping
- [x] `@nestjs/throttler` — global default (100 req/min) via `APP_GUARD`, tightened to
      10 req/min on `/auth/register`, `/auth/login`, `/auth/refresh` specifically
- [x] `cookie-parser` wired in `main.ts`; refresh token delivered as an
      httpOnly/`SameSite=Lax` cookie scoped to `/api/v1/auth` (`secure` in production
      only, so local HTTP dev still works) **and** always present in the JSON response
      body (see Deviations — mobile needs the body, web is expected to prefer the
      cookie)
- [x] 39 new/updated unit tests across `password.service.spec.ts`,
      `tokens.service.spec.ts` (rotation, reuse-detection, logout, both revocation
      paths), `jwt-auth.guard.spec.ts`, `auth.service.spec.ts`, and an added case in
      `http-exception.filter.spec.ts`
- [x] 7 new `apps/api-e2e` integration tests (`auth-flow.spec.ts`,
      `refresh-reuse.spec.ts`, `refresh-expiry.spec.ts`) against the real Dockerized
      Postgres and a real running Nest server: the full
      register→login→session→refresh→logout lifecycle, duplicate-registration
      conflict, wrong-password/nonexistent-user parity, unauthenticated `/session`,
      full reuse-detection (replaying both the original and the token it was rotated
      into), and a backdated-row expiry scenario proving expiry alone never revokes a
      family
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) + `api-e2e:e2e` (6/6 suites, 11/11 tests) against the live Dockerized
      Postgres, plus a full manual curl walkthrough of every flow before the automated
      suite was written (see "Validation Performed" below)

---

## Validation Performed

### Milestone 0

```bash
pnpm exec nx run-many -t lint test build   # 11/11 projects
pnpm exec nx run api-e2e:e2e                # 1/1 test, real Nest server on :3000
pnpm exec nx run web-e2e:e2e -- --project=chromium   # 1/1 test
pnpm exec nx run prisma:generate            # Prisma Client generated
pnpm exec nx run prisma:migrate-status      # connects to Postgres correctly (reports "no migrations" — expected, schema is empty)
pnpm exec nx run mobile:export              # Metro bundles web/iOS/Android successfully
```

Docker Compose services (`postgres`, `redis`, `minio`, `minio-init`, `maildev`) all
started healthy.

### Milestone 2

```bash
pnpm exec prisma migrate dev --name 0001_init_user_auth --create-only  # generate migration SQL
pnpm exec prisma migrate dev                # apply it (fresh DB — this Postgres had zero tables before this)
pnpm exec prisma migrate status             # "Database schema is up to date!"
pnpm exec prisma db seed                    # ran twice — second run confirmed idempotent (still 3 rows)
pnpm exec nx run prisma:generate            # regenerated Prisma Client with the new models
pnpm exec nx run prisma:typecheck           # new target — typechecks seed.ts
pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects
pnpm exec prettier --check "prisma/**/*.{ts,json}" "package.json" "pnpm-workspace.yaml"
```

Schema verified directly against Postgres (`docker exec ... psql -c '\d users' -c '\d
refresh_tokens'`) — column types, defaults, indexes, and the FK/cascade all match
`docs/DATABASE.md` exactly.

**A true "fresh database" migrate test** (`prisma migrate reset`) was attempted for
extra certainty but was blocked by Prisma's own AI-agent safety guard, which requires
explicit human confirmation before a destructive reset. This wasn't pursued further —
it wasn't actually necessary: the migration had already applied cleanly to what was, in
fact, a genuinely empty database (this Postgres instance's first-ever migration), which
already satisfies `docs/IMPLEMENTATION_PLAN.md` Milestone 2's test criterion. See
"Known Issues / Follow-ups" below.

**Note for whoever continues this work**: the above were run interactively; there is
no CI pipeline yet. Wiring `nx affected -t lint test build e2e` into CI is explicitly
scoped to Milestone 20 (hardening pass) in `docs/IMPLEMENTATION_PLAN.md`, not before.

### Milestone 3

```bash
pnpm exec nx run-many -t lint test build -p types,validation --skip-nx-cache
# ^ caught a real bug on the first pass: @nx/dependency-checks flagged
#   @instagram-clone/types as declared-but-unused in packages/validation
#   (added preemptively, per docs/ARCHITECTURE.md §6.1, but M3 doesn't
#   actually need it yet — pagination schemas are out of scope). Removed the
#   dependency rather than suppress the lint rule; it'll come back the
#   milestone that actually imports from `types` into `validation`.
pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

36 new schema tests (`packages/validation`) + 2 new type-shape tests (`packages/types`),
all passing. No Docker/Postgres interaction needed for this milestone — pure
TypeScript/Zod, no runtime service dependency.

### Milestone 4

```bash
# Verified the ESM-vs-CJS risk empirically before building anything else — see
# "Bugs Found" below for why this specific check mattered:
pnpm exec nx run api:build --skip-nx-cache   # with just a bare PrismaService stub
node dist/apps/api/main.js                    # booted correctly (Nest app started;
                                               # only failed on a port already in use
                                               # from a stray earlier process)

pnpm exec nx run-many -t lint typecheck test build -p api --skip-nx-cache
# ^ found and fixed, in order: a missing `express` dependency (TS2307), a
#   `getZodError(): unknown` type gap in nestjs-zod's own declarations
#   (TS2571 — needed an explicit `as ZodError` cast), and a missing `zod`
#   dependency (TS2307 again) — apps/api had never directly imported zod's
#   types before. See "Bugs Found" below for the full detail on each.

pnpm exec nx run api-e2e:e2e --skip-nx-cache
# ^ 4/4 passing against the real Dockerized Postgres — logs confirmed
#   "PrismaService: Connected to the database" and the health/openapi/
#   problem-details routes all registered and responded correctly.

pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

### Milestone 5

```bash
pnpm exec nx run api:test --skip-nx-cache
# ^ found the @nestjs/jwt ESM/CJS incompatibility on the first run — see "Bugs Found"
#   below. After downgrading to 11.0.2: 7/7 suites, 39/39 tests passing.

pnpm exec nx run api:build --skip-nx-cache   # re-verified after the jwt downgrade — webpack still compiles cleanly
```

**Manual end-to-end verification against the real server + real Dockerized Postgres**,
done deliberately _before_ writing the automated `api-e2e` suite (this milestone's
rotation/reuse-detection logic was the trickiest thing built so far and warranted
seeing it work against a live database first): booted `nx run api:serve` in the
background and drove every flow with `curl` + a cookie jar —
register/login/session/refresh/logout, refresh-token rotation, **reuse detection and
family revocation** (replaying both an old rotated-away token and the token it was
rotated into, confirming both correctly return `refresh-token-reused` only after the
family is actually revoked), duplicate-registration conflict (`409`),
wrong-password/nonexistent-user parity (`401`, `password.verify` still invoked either
way), validation errors (`400`), rate limiting (`429` after 5–6 requests in the 10/60s
window), and cross-milestone integration (seed user `alice`, password `Password123!`,
logs in through the new endpoints). One apparent anomaly during this pass (a
post-logout refresh returning "invalid token" instead of "reused") turned out to be the
test script itself overwriting its own cookie file on the logout call, not a bug —
confirmed by re-presenting the raw token value directly and seeing the correct
`refresh-token-reused` response. Manually-created test users were deleted from Postgres
afterward; only the Milestone 2 seed users (`alice`/`bob`/`carol`) remain.

```bash
pnpm exec nx run api-e2e:e2e --skip-nx-cache
# ^ 6/6 suites, 11/11 tests passing against the live Dockerized Postgres — the new
#   auth-flow.spec.ts, refresh-reuse.spec.ts, and refresh-expiry.spec.ts all passed on
#   the first run once the manual walkthrough above had already validated the behavior.
#   refresh-expiry.spec.ts reaches into Postgres directly (a raw PrismaClient in
#   apps/api-e2e/src/support/db.ts) to backdate a token's expiresAt, since the API has
#   no route that can fast-forward the real 30-day TTL.

pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

---

## Deviations From the Original Docs (and why)

`docs/ARCHITECTURE.md` was written before any dependency was actually installed;
a few of its version numbers and one design detail turned out to need adjustment
once real installs happened. Recorded here rather than silently diverging:

- **NestJS is 11.2.5, not a "v12 line."** `@nx/nest` (the Nx plugin that scaffolds
  Nest apps) currently generates against Nest 11 even though NestJS 12 exists
  upstream; Nx's own tooling hasn't caught up yet. Using 11.2.5 was the correct
  call for "leave the repo in a working state" — see `ARCHITECTURE.md` risk #9.
  Revisit once `@nx/nest` supports Nest 12.
- **Next.js is 16.3.6** (the `@nx/next` generator initially installed 16.1.7; bumped
  to the current stable release, 16.3.6, immediately).
- **Expo SDK is 56** (`expo` 56.0.22, `expo-router` 56.2.21) — matches "latest Expo"
  at the time of scaffolding.
- **Prisma is 7.10.0.** `prisma`'s npm `latest` dist-tag currently points at an
  8.0.0 release candidate; 7.10.0 (the `prev` tag) is the actual latest _stable_ v7,
  matching the explicit "Prisma 7" requirement.
- **`packages/config` was built for real in this milestone**, not deferred to a later
  one as the original `IMPLEMENTATION_PLAN.md` M3 sketch suggested — the pasted
  task instructions for this milestone explicitly listed "environment variable
  handling" as an M0 deliverable, which takes precedence over the plan doc's
  earlier, coarser milestone split. `packages/types`/`packages/validation`/
  `packages/api-client` were intentionally left as generator placeholders, since
  their real content is genuinely feature-shaped (per `IMPLEMENTATION_PLAN.md`).
- **`web`'s dev/start port is 4200, not Next's default 3000.** `apps/api` defaults
  its `PORT` to 3000 to match Nx's own generated `api-e2e` test harness
  (`global-setup.ts`/`test-setup.ts`/`global-teardown.ts` all hardcode a 3000
  fallback), so `web` moved instead. See `apps/web/project.json` and
  `apps/web-e2e/playwright.config.mts`.
- **Postgres's host port is 5433, not 5432.** Several developer machines (including
  the one this milestone was built on) already run a native/other Postgres bound to
  5432; mapping the container to 5433 avoids silently connecting to the wrong
  database. See `docker-compose.yml`.
- **MinIO's image moved to `quay.io/minio/minio` and `quay.io/minio/mc`.** MinIO
  removed `minio/minio` and `minio/mc` from Docker Hub on 2026-09-11; the
  `docker-compose.yml` originally drafted in the architecture phase (before this was
  known) used the now-dead Docker Hub path.
- **`mobile`'s `build` target now runs `expo export` (local Metro bundling), not an
  EAS cloud build.** The `@nx/expo:build` executor's real job is triggering an EAS
  Build in the cloud, which needs `eas-cli` installed and an authenticated Expo
  account — not appropriate for a routine local/CI "does this compile" check. The
  original EAS behavior is preserved under a new `mobile:build-eas` target for when
  someone actually wants a cloud build. See `apps/mobile/project.json`.

None of these change anything in `docs/DATABASE.md`, `docs/API.md`, or
`docs/FEATURES.md` — no schema, endpoint, or feature-scope decisions were touched
in this milestone.

### Milestone 2

Three deviations from `docs/DATABASE.md`'s original `User` table design, all recorded
in full (with rationale) in `docs/DATABASE.md` itself — summarized here:

- **`User.avatarMediaId` is not in this migration.** It's a nullable FK to `Media`,
  which doesn't exist until Milestone 9. Adding it now would mean a relation-less
  dangling column for seven milestones; it lands with `Media` instead. See
  `docs/DATABASE.md` §3.1.
- **`User`'s `deletedAt` index is a plain B-tree, not the partial index
  (`WHERE deletedAt IS NULL`) originally specified.** Prisma's schema DSL has no
  partial-index syntax; maintaining one by hand outside Prisma's migration diffing
  indefinitely is real ongoing complexity for a micro-optimization with zero rows to
  benefit from it yet. See `docs/DATABASE.md` §3.1.
- **Only `citext` is enabled in this migration — `pgcrypto` and `pg_trgm` are
  deferred** to the migrations that actually use them (Milestone 17 for `pg_trgm`;
  `pgcrypto` turned out to be unneeded at all, since `@default(uuid(7))` generates
  ids in the Prisma Client, not via a Postgres function). See `docs/DATABASE.md` §5.

`docs/ARCHITECTURE.md` risk #1 (Prisma 7 config/migration approach) and risk #6
(citext decision) are both marked resolved, pointing back here.

### Milestone 3 — Architectural Decisions Made

`docs/IMPLEMENTATION_PLAN.md` and `docs/FEATURES.md` both left two things
unspecified, explicitly deferring them to "the shared Zod schema" — i.e. this
milestone. Both are now decided and recorded in `docs/API.md` §3:

- **Password policy: length-only (8–128 characters), no mandated character
  classes.** Follows NIST SP 800-63B guidance that complexity rules (require a
  digit, a symbol, etc.) push users toward predictable substitutions
  (`Password1!`) without meaningfully improving resistance to guessing —
  length is what actually matters. The 128-char upper bound is a defensive
  limit on hashing cost, not a security rule. Implemented as `passwordSchema`
  in `packages/validation/src/lib/auth.ts`.
- **`POST /auth/logout`'s body needed a resolved shape.** The original
  `docs/API.md` draft only showed `{ allDevices? }`, but mobile has no cookie
  to carry the refresh token being revoked — the same web-cookie/mobile-body
  split already used by `/auth/refresh` has to apply here too. Resolved as
  `LogoutInputSchema = { refreshToken?, allDevices? }`; `docs/API.md` §3 updated
  to match and to spell out the pattern once instead of repeating it per row.

Neither decision changes anything in `docs/DATABASE.md` — both are
request-validation-layer concerns, not schema changes.

### Milestone 4

- **`@nestjs/swagger` is pinned to `11.4.7`, not the `12.x` line.** Same situation as
  the NestJS-11 deviation above: `@nestjs/swagger@12.0.2`'s `latest` dist-tag requires
  `@nestjs/core ^12.0.0`, which this repo doesn't run. `11.4.7` is the actual latest
  release compatible with our NestJS 11.2.5. `nestjs-zod@5.5.0` (no such conflict —
  its peer range already covers Nest 11) was installed alongside it.
- **`openapi.json` is not yet a literal Nx build-output file.** `docs/ARCHITECTURE.md`
  §5.2 and `docs/API.md` §15 originally described it as a build artifact; it's
  currently served over HTTP (`/api/docs-json`) from a running server instead. Making
  it a real on-disk artifact (so `api:build` alone, without booting the HTTP server,
  produces it) is deferred to Milestone 6, once `packages/api-client`'s actual
  consumption pattern exists to design the mechanism against — inventing that
  mechanism now, with no consumer, would be guessing. Both docs updated to say so
  explicitly rather than describe unbuilt behavior as done.
- **`class-validator`/`class-transformer` were deliberately not installed**, despite
  being listed as peer dependencies of `@nestjs/swagger`. They're only needed if a DTO
  uses their decorators; `nestjs-zod`'s whole purpose is making that unnecessary. pnpm
  emits no hard error for the unmet peers (only satisfied by nestjs-zod's own
  operation), and the full build/test/e2e suite confirms nothing actually needs them.

None of Milestone 4's changes touch `docs/DATABASE.md` or `docs/FEATURES.md` — this
milestone is bootstrap plumbing, not schema or product-feature work.

### Milestone 5

- **`@nestjs/jwt` is pinned to `11.0.2`, not the `12.x` line.** Same root cause as the
  NestJS-11/`@nestjs/swagger`-11 deviations above (`12.x` needs `@nestjs/core ^12.0.0`),
  compounded by `12.x` also being pure ESM with no CommonJS build at all — see "Bugs
  Found" below. `11.0.2` is CJS and Jest-compatible.
- **Access tokens are signed `HS256` (symmetric), not an asymmetric algorithm.**
  `docs/ARCHITECTURE.md` §7 originally specified `RS256`/`EdDSA` so a public key could
  verify tokens outside the API process. Nothing outside `apps/api` verifies access
  tokens today — `JwtAuthGuard` is the only verifier, in the same process that signs —
  so asymmetric signing has no current benefit, only extra key-management complexity.
  Revisit if a second service (e.g. a separate media-processing worker) ever needs to
  verify tokens independently. `docs/ARCHITECTURE.md` §7 updated to describe this.
- **`ThrottlerModule` uses in-memory storage, not Redis**, despite Redis already
  existing in `docker-compose.yml`. `@nestjs/throttler`'s default in-memory storage is
  correct for a single-process API (true today) and is the simplest thing that
  satisfies "`@nestjs/throttler` applied to `/auth/*`" as literally stated in
  `docs/IMPLEMENTATION_PLAN.md` M5. A Redis-backed store only matters once `apps/api`
  runs as more than one instance behind a load balancer, which isn't the case yet —
  revisit alongside any future horizontal-scaling milestone. `docs/ARCHITECTURE.md`
  §5.2 updated to record this explicitly rather than silently diverge from the original
  "Redis-backed" wording.
- **A custom (non-Passport) `JwtAuthGuard`, not `@nestjs/passport` + `passport-jwt`.**
  There is exactly one auth strategy (Bearer JWT); Passport's strategy-registry
  abstraction earns its keep with multiple strategies (OAuth, sessions, etc.), not one.
  A ~30-line guard doing `verifyAsync` + a Prisma lookup is simpler to read and test
  than wiring up a `PassportStrategy` subclass, a `PassportModule`, and Passport's own
  request-augmentation, for identical runtime behavior.
- **`AuthResponseSchema`/`RefreshResponseSchema`'s `refreshToken` is always present in
  the response body**, not only for mobile as `docs/API.md` §3 originally implied. See
  the corrected wording there (§3, footnote) for the full rationale: the API has no
  reliable client-type signal at register/login time, so it returns the token both ways
  rather than guess; web is expected to prefer the httpOnly cookie. Revisit once
  Milestone 6 gives an actual web client to design a suppression signal against.

None of Milestone 5's changes touch `docs/DATABASE.md` or `docs/FEATURES.md` — the
`RefreshToken` schema and the auth feature scope were both already fully specified by
Milestones 2 and 3 respectively; this milestone only implements against them.

---

## Bugs Found and Fixed

Worth recording since they'd otherwise resurface identically for the next person:

### Milestone 0

1. **`NODE_ENV` must never be set in the shared `.env`.** Nx loads the workspace
   root `.env` into every task's process environment, including `next build`, which
   needs to manage its own `NODE_ENV` internally. A pre-set `NODE_ENV=development`
   caused `next build` to crash prerendering with `TypeError: Cannot read properties
of null (reading 'useContext')` on every route. Removed from `.env.example`;
   `packages/config`'s `apiEnvSchema` already defaults it to `"development"` when
   absent, so nothing else needed to change.
2. **`apps/api`'s webpack build was externalizing `@instagram-clone/*` packages**,
   producing a runtime `require('@instagram-clone/config')` that pnpm's workspace
   symlink resolves to `packages/config/package.json`, whose `main` field
   (`./src/index.js`) only exists after that package's own `dist/` build — never in
   the symlinked source directory. Fixed by passing an explicit
   `externalDependencies` allowlist (derived from the real npm deps in the root
   `package.json`, excluding the `@instagram-clone/*` scope) to `NxAppWebpackPlugin`
   in `apps/api/webpack.config.js`, so workspace packages get bundled inline instead.
3. **Expo Router treats every file under its app root as a route**, including test
   files. `apps/mobile/src/app/index.spec.tsx` was being bundled as if it were a
   screen, pulling in `@testing-library/react-native` (which imports Node's
   `console` module, unavailable to Metro) and breaking `expo export`. Moved to
   `apps/mobile/src/__tests__/index.spec.tsx`, outside the router root.
4. **`ts-jest` doesn't inherit `tsconfig.app.json`'s decorator settings.**
   `apps/api/tsconfig.spec.json` extends `tsconfig.json`, not `tsconfig.app.json`, so
   it was missing `experimentalDecorators`/`emitDecoratorMetadata` — without them,
   NestJS's `@Controller()`/`@Get()` decorators silently use the wrong (Stage-3,
   non-legacy) semantics under Jest, crashing with
   `TypeError: Cannot read properties of undefined (reading 'value')` the moment a
   decorated class loads. Added both options directly to `tsconfig.spec.json`.
5. **`@typescript-eslint/consistent-type-imports` (added in `packages/eslint-config`)
   is actively dangerous for NestJS constructor injection** — auto-fixing an
   injected class to `import type` erases the value binding
   `emitDecoratorMetadata` needs at runtime, breaking DI. Disabled for `apps/api` in
   `apps/api/eslint.config.mjs`, with the reasoning recorded inline.
6. **TypeScript 6.0's `baseUrl` deprecation** made `ts-jest` (used by `apps/api`)
   hard-fail with `TS5101`. Added `"ignoreDeprecations": "6.0"` to
   `tsconfig.base.json`.
7. **`noPropertyAccessFromIndexSignature` (an extra strictness flag beyond
   `"strict": true`) broke Next's own generated CSS-module usage** (`styles.page`).
   Removed it — it fights an extremely common, idiomatic Next.js pattern for no
   corresponding safety benefit.
8. **Next inferred the wrong monorepo root** ("We detected multiple lockfiles...")
   because an unrelated `package-lock.json` exists in the machine's home directory,
   above this repo. Pinned explicitly via `turbopack.root` in `apps/web/next.config.js`.

### Milestone 4

9. **A real risk that turned out fine, worth recording so nobody re-litigates it**:
   Prisma 7's generated client (`prisma/generated/prisma/client.ts`) uses
   `import.meta.url` — ESM-only syntax — while `apps/api` builds to CommonJS. This
   looked like it could force a much bigger architectural change (ESM output for the
   whole API app). Verified empirically before writing any real code: webpack
   transforms `import.meta.url` correctly regardless of target module format, and the
   built bundle runs with zero `import.meta` references left in it. No workaround
   needed.
10. **Three missing dependencies, one per compile attempt**: `express` (needed for
    `Request`/`Response` types in the exception filter — was only ever a transitive
    dependency of `@nestjs/platform-express`, and pnpm's strict `node_modules`
    correctly refused to resolve it), then `zod` (apps/api had never directly imported
    Zod's types before, only Zod-derived schemas from `packages/validation`). Both
    added as explicit `apps/api` dependencies (real npm packages, not
    `@instagram-clone/*` workspace packages — no risk of the Milestone-0 externals bug).
11. **`nestjs-zod@5.5.0`'s own type declarations type `getZodError(): unknown`**
    (deliberately, to stay agnostic between Zod 3/4's slightly different `ZodError`
    shapes) — `ts-jest` didn't catch this (its type-checking is looser than the
    webpack/`tsc` build path), so unit tests passed while `nx run api:build` failed
    with `TS2571`. Fixed with an explicit `as ZodError` cast, documented inline as to
    why it's needed given this repo is pinned to Zod 4. Worth remembering: **passing
    unit tests do not guarantee the build passes** — `nx run-many -t ... build` (not
    just `test`) is part of every milestone's validation for exactly this reason.

### Milestone 5

12. **`@nestjs/jwt@12.0.2` is pure ESM with no CommonJS build at all**
    (`"type": "module"`, `exports` only offering an `import` condition). The webpack
    build (`nx run api:build`) compiled fine regardless — webpack handles ESM
    dependencies natively — but `ts-jest`'s CJS-based runtime failed every suite that
    transitively imported it (`tokens.service.spec.ts`, `auth.service.spec.ts`,
    `jwt-auth.guard.spec.ts`) with `SyntaxError: Cannot use import statement outside a
module`. The inverse of bug #11 above: this time the **build** passed while
    **tests** failed, underscoring the same lesson from the other direction — build and
    test can fail independently of each other, so both are required, every milestone.
    Fixed by pinning to `11.0.2` (CJS, Jest-era build), the same resolution pattern
    already established for `@nestjs/swagger` in Milestone 4.
13. **`docs/API.md` §3's `/auth/refresh` row conflated reuse with plain expiry**,
    reading "`401` + full family revocation if a reused/expired token is presented" —
    but the actual (and correct, `docs/ARCHITECTURE.md` §7-aligned) behavior only
    revokes the family on genuine reuse (a token already marked `revokedAt`); a token
    that's merely past its `expiresAt` is not suspicious and must not trigger
    revocation, or an ordinary idle session would look identical to an attack. Caught
    while writing `tokens.service.spec.ts`'s expiry test and confirmed against
    `tokens.service.ts`'s actual `rotate()` branching. Fixed the wording in
    `docs/API.md` §3 rather than the code — the code was already right.

---

## Known Issues / Follow-ups (non-blocking)

- `packages/*`'s generated `vitest.config.mts` files use `@nx/vite/plugins/nx-*`
  helpers that Nx itself flags as deprecated (removal in Nx v24). This is generator
  output, not something this milestone hand-wrote; revisit when `@nx/js:lib`'s
  default template updates upstream, rather than hand-patching every package now.
- `apps/api-e2e`'s generated `jest.config.cts` logs a harmless Node ESM-loader
  warning ("Failed to load the ES module... jest.config.cts") on every run. Cosmetic;
  doesn't affect results.
- Web E2E was only run against Chromium (`--project=chromium`); Firefox/WebKit
  browsers were not installed in this environment. Fine for this milestone — install
  them (`pnpm exec playwright install`) before relying on cross-browser coverage.
- This machine has a native/other Postgres already listening on 5432 and a stray
  `node_modules`/`package-lock.json` in the user's home directory (outside this
  repo). Neither was touched, but both required the workarounds noted above —
  worth knowing about if the same symptoms reappear on a fresh clone elsewhere
  (they likely won't, since that's this machine's local state, not the repo's).
- **`prisma migrate reset` was not run** in Milestone 2 (see "Validation Performed"
  above) — Prisma's own AI-agent safety guard blocked it, and it wasn't pursued since
  it wasn't actually necessary. If a genuinely from-scratch "does this migration apply
  to an empty database" check is ever needed again (e.g. after several more migrations
  have accumulated and drift is a real concern), that's a person-run command, not an
  agent-run one — see the guard's own message for why.
- `prisma/seed.ts`'s dev password (`Password123!`, hashed with `argon2id` before
  storage — never stored in plaintext) is fixture data for local development and
  integration tests only. As of Milestone 5 these accounts (`alice`/`bob`/`carol`) are
  now actually log-in-able through the real `/auth/login` endpoint — worth remembering
  this is still a shared, publicly-known dev password, not a real credential scheme, if
  this repo is ever exposed anywhere beyond a local machine.
- **The generated Prisma Client logs `◇ injected env (N) from .env` on every import**,
  independent of and in addition to `apps/api`'s own `import 'dotenv/config'`. Harmless
  (it finds nothing left to inject, hence usually `(0)`) but slightly noisy console
  output on every boot; nothing to fix on our side — it's Prisma's generated code, not
  ours, and there's no documented way to suppress it.
- `nx run-many -t ... build` occasionally logs `Nx detected a flaky task: api:build`
  when run twice in a row with `--skip-nx-cache`. Every run has still succeeded
  (confirmed by re-running); this looks like Nx's flakiness heuristic reacting to
  non-deterministic content in the webpack output hash (timestamps, or the Prisma
  console noise above) rather than an actual intermittent failure. Not investigated
  further — it's an Nx Cloud upsell nudge, not a build failure, and this repo doesn't
  use Nx Cloud.

---

## Architectural Decisions Pending

None. Milestone 3 resolved the two decisions `docs/IMPLEMENTATION_PLAN.md` and
`docs/FEATURES.md` had explicitly deferred to it (password policy, logout body shape).
Milestone 4 made no new open-ended decisions — its two deviations (`@nestjs/swagger`
version, `openapi.json`-as-file deferred) are both externally forced or explicitly
deferred to a specific future milestone, not undecided. Milestone 5's five deviations
(`@nestjs/jwt` version, `HS256` vs asymmetric signing, in-memory vs Redis throttler
storage, a custom guard instead of Passport, `refreshToken` always in the response
body) are each decided and recorded above with rationale and an explicit revisit
trigger, not left open. Everything else recorded in this file is
implementation-detail-level — versions, ports, a webpack externals list, one deferred
column, one simplified index, two deferred extensions — with rationale in
`docs/DATABASE.md` and `docs/ARCHITECTURE.md` where it touches those docs. None of it
changes anything either document asserts at the design level.

---

## Next Milestone

**Milestone 6 — Web Bootstrap + Auth UI**: per `docs/IMPLEMENTATION_PLAN.md`, generate
`apps/web` for real via `@nx/next` conventions already established (App Router, Next
16 — the shell has existed since Milestone 0, this is where it gets actual pages) and
create `packages/api-client` for real (currently a Milestone-0 placeholder). This is
the milestone that stands up and proves, end-to-end, the OpenAPI-codegen pipeline
`docs/ARCHITECTURE.md` §6.2/§6.3 and `docs/API.md` §15 describe but nothing has
exercised yet:

1. `apps/api`'s already-served OpenAPI document (`/api/docs-json`, Milestone 4) feeds
   `openapi-typescript` (`packages/api-client`'s `build` target, `dependsOn:
["api:build"]`) to generate request/response types for exactly the five auth
   endpoints Milestone 5 just implemented.
2. A hand-written transport layer in `packages/api-client` on top of those generated
   types: a `fetch` wrapper, an auth-refresh interceptor (401 → call `/auth/refresh` →
   retry once), Problem Details error unwrapping, and — per `docs/ARCHITECTURE.md` §7's
   storage-per-client note — a storage-adapter interface designed now even though only
   the web (cookie) adapter is implemented yet, so Milestone 7 doesn't need to change
   the interface shape for the mobile (`expo-secure-store`) adapter.
3. Web auth pages (register, login, a logout action, a minimal authenticated shell)
   using Server Actions calling `api-client` — the first real UI in this repo.
4. **Tests**: unit tests for `api-client`'s fetch/refresh-retry logic (mocked HTTP);
   the first real `apps/web-e2e` Playwright test, covering register → login → land on
   the authenticated shell → logout against the real API from Milestone 5.

Before starting it: re-read `docs/IMPLEMENTATION_PLAN.md`'s Milestone 6 section and
`docs/ARCHITECTURE.md` §6 (Shared Packages) in full — §6.2 in particular, since this is
the milestone that turns its "why REST + hand-written client instead of tRPC-style
inference" reasoning into actual code for the first time. Also worth noting before
designing the storage adapter: `AuthResponseSchema`'s `refreshToken` is always present
in the response body now (Milestone 5 deviation, above) specifically so this milestone
doesn't need a client-type signal invented for it — the web adapter can simply ignore
that field and rely on the cookie the API already sets.
