# Project Progress

This file tracks the current implementation status of the Instagram clone.

It should be updated after every completed milestone or meaningful development session.

---

## Current Status

**Phase:** Infrastructure
**Current Milestone:** Milestone 7 — Mobile Bootstrap + Auth UI
**Status:** Complete

The Nx/pnpm monorepo, all three application shells (web, api, mobile), the five
shared packages, the Prisma toolchain, and local Docker infrastructure are all
scaffolded and passing validation (Milestone 0, with Docker infra/Milestone 1 landing
as a side effect of it). The first real database models — `User` and `RefreshToken` —
are implemented, migrated, and seeded (Milestone 2). `packages/types` and
`packages/validation` carry real, tested content for everything auth needs
(Milestone 3). `apps/api` has a real DI graph — a Prisma-backed database connection, a
global Zod validation pipe, an RFC 7807 error format, and live OpenAPI docs — proven by
a real `GET /api/v1/health` endpoint (Milestone 4). `apps/api`'s first real _feature_
module, `AuthModule`, implements all five `docs/API.md` §3 endpoints
(register/login/refresh/logout/session) against real HTTP traffic and the live
Postgres — `argon2id` password hashing, JWT access tokens carrying a `tokenVersion`
claim, opaque refresh tokens with rotation + reuse-detection family revocation, and
`@nestjs/throttler` on the credential-facing routes (Milestone 5). `packages/api-client`
is real too: an OpenAPI-codegen pipeline (`apps/api`'s routes → a generated
`openapi.json` → generated TS types) proven end-to-end, and a hand-written,
storage-adapter-agnostic transport layer (`HttpClient`/`AuthClient`) with a real
auth-refresh-and-retry interceptor. `apps/web` has its first real pages — register,
login, and a minimal authenticated `/home` shell — built as Server Components/Actions
calling `api-client`, with its own httpOnly session cookie and a `proxy.ts` that keeps
it fresh (Milestone 6). `apps/mobile` now has the same treatment: register, login, and
a minimal authenticated tab shell, backed by an `expo-secure-store` `TokenStorage`
adapter that proved out the storage-adapter abstraction on its second, structurally
different implementation with zero changes to the shared transport (Milestone 7). The
three seed users (`alice`/`bob`/`carol`, Milestone 2) can now log in through either real
UI, not just `curl`. No other product feature endpoints or pages exist yet
(posts/follows/feed/etc.) — those start with Milestone 8.

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

### Milestone 6 — Web Bootstrap + Auth UI

- [x] **OpenAPI codegen pipeline stood up end-to-end** (`docs/ARCHITECTURE.md` §6.2,
      risk #2): `nx run api:generate-openapi` — a new script
      (`apps/api/src/generate-openapi.ts`) that boots `AppModule` with
      `abortOnError: false` and builds the same Swagger document `main.ts` serves live,
      writing it to a gitignored `apps/api/openapi.json` **without** needing a
      reachable Postgres (verified by running it against a deliberately-bad
      `DATABASE_URL`) — feeds `nx run api-client:generate-types`, which runs
      `openapi-typescript` against it to produce a gitignored
      `packages/api-client/src/generated/openapi-types.ts`. `main.ts` refactored to
      share the document-building/versioning logic with the new script
      (`openapi-document.ts`, `app/configure-app.ts`) instead of duplicating it.
- [x] `packages/api-client` implemented for real (was a Milestone-0 placeholder):
      `HttpClient` (fetch wrapper, auth-refresh-and-retry-once-on-401 interceptor,
      RFC 7807 error unwrapping into a typed `ApiError`), a `TokenStorage` interface
      (the storage-adapter abstraction risk #5 called for), and `AuthClient`
      (register/login/logout/session) built on top of both — typed directly against
      `packages/validation`'s existing schemas, not the generated OpenAPI types (see
      Deviations below for why)
- [x] `apps/web`'s first real pages, replacing the Milestone-0 generator placeholder:
      `(auth)/register`, `(auth)/login` (both Server Actions + a `useActionState`
      client form for inline error display), a stub authenticated `(app)/home` shell,
      and a root `/` that redirects to whichever of those two is appropriate — route
      groups matching `docs/ARCHITECTURE.md` §5.1's convention
- [x] `apps/web`'s own session: a single httpOnly/Secure/SameSite=Lax cookie on
      `apps/web`'s own origin (`lib/session-cookie.ts`, `lib/web-token-storage.ts`),
      **not** a shared cookie with the API — see the Deviations entry below for why the
      original cross-origin-cookie design in `docs/ARCHITECTURE.md` §5.1/§7 couldn't
      actually work as drafted, and what replaced it
- [x] `apps/web/src/proxy.ts` (Next 16's renamed `middleware.ts`) — proactively
      refreshes the session's access token on protected routes when it's actually
      expired, which is what keeps a real (non-instant) session from tripping refresh-
      token reuse-detection the next time a Server Component needs to read it (see
      Deviations below for the full mechanics)
- [x] `packages/config`'s `webEnvSchema`/`loadEnv()` wired into `apps/web` for real for
      the first time (`lib/env.ts`) — fails fast on a missing `NEXT_PUBLIC_API_URL`
- [x] Removed the Milestone-0 placeholder page content (`page.module.css`, the
      `/api/hello` route, the generator's default homepage markup) now that real pages
      exist
- [x] 28 new unit tests: 19 in `packages/api-client` (`http-client.spec.ts`,
      `auth-client.spec.ts`, plus `openapi-contract.spec.ts` — a compile-time-only
      drift detector between the generated OpenAPI types and the routes this client
      actually wraps) and 9 in `apps/web` (`session-cookie.spec.ts`,
      `auth-error-message.spec.ts` — pure-logic tests; Server Component auth/redirect
      logic isn't meaningfully unit-testable and is covered by the e2e suite instead)
- [x] 4 new `apps/web-e2e` Playwright tests (`auth-flow.spec.ts`) against the real
      running `web` dev server **and** a real running `api` server/Postgres: the full
      register → land on `/home` → (already-authenticated `/login` bounces back to
      `/home`) → logout → (`/home` now bounces to `/login`) lifecycle, logging back in
      as the same user, a wrong-password error shown inline without leaving the page,
      and an unauthenticated visit to `/home` redirecting to `/login`
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) + `api-e2e:e2e` (6/6 suites) + `web-e2e:e2e` (4/4, Chromium) against
      the live Dockerized Postgres and real running `api`/`web` servers

### Milestone 7 — Mobile Bootstrap + Auth UI

- [x] `expo-secure-store` installed via `pnpm exec expo install` (per `CLAUDE.md`),
      which also registered its config plugin in `apps/mobile/app.json` automatically
- [x] `apps/mobile/src/lib/mobile-token-storage.ts` — a `TokenStorage` implementation
      (docs/ARCHITECTURE.md §7, risk #5) storing both tokens together as one
      JSON-serialized SecureStore item, keyed `session` — the straightforward design
      the architecture doc originally described for both platforms, since mobile has
      none of `apps/web`'s "cookies are only writable from a Server Action" constraint
- [x] `apps/mobile/src/lib/api-client.ts` — a module-level `apiClient` singleton (built
      once at load, unlike `apps/web`'s per-request client) wired to the SecureStore
      adapter; confirmed `HttpClient`/`AuthClient` needed **zero** changes to support
      it, the actual test of whether Milestone 6's storage-adapter design was real
- [x] `apps/mobile/src/lib/auth-context.tsx` — a plain React context (no Server
      Components/Actions on-device) checking `apiClient.auth.session()` once on mount;
      screens read `user`/`loading` from it and call `setUser`/`logout` after their own
      `apiClient.auth.*` calls
- [x] Mobile auth screens replacing the Milestone-0 placeholder: `(auth)/login`,
      `(auth)/register` (plain `TextInput`/`Pressable` forms, no server-driven form
      state library — there's no on-device equivalent to `useActionState`), a
      `(tabs)/home` stub shell (matching `apps/web`'s `/home` scope exactly), and a
      root `index.tsx` that shows a loading spinner during the initial session check
      then `<Redirect>`s to whichever screen is appropriate
- [x] `apps/mobile/src/lib/env.ts` — `packages/config`'s `mobileEnvSchema`/`loadEnv()`
      wired in for the first time, with `EXPO_PUBLIC_API_URL` referenced as its own
      literal `process.env.EXPO_PUBLIC_...` expression (not passed through generically)
      so Expo's babel-time inlining actually replaces it in on-device bundles — passing
      the whole `process.env` object through, the way `apps/web`'s equivalent does,
      would silently produce an empty config outside of Jest/Node (see Deviations below)
- [x] 24 new unit tests: 8 pure-logic (`mobile-token-storage.spec.ts` — mocked
      `expo-secure-store`; `auth-error-message.spec.ts`, mirroring `apps/web`'s) and 16
      component tests (`login.spec.tsx`, `register.spec.tsx`, `home.spec.tsx`, all under
      `src/__tests__/` — see Bugs Found below for why not co-located under `src/app/`)
      covering the success path, an inline error on failure, and that `setUser`/
      navigation are never called when the API call fails
- [x] Manually verified the built web export actually boots (headless Chromium against
      `expo start --web`'s real dev server and a real running `api`): confirmed
      `expo-secure-store` has no web implementation at runtime (`getValueWithKeyAsync is
    not a function`) — expected, not a bug, since `apps/mobile`'s supported targets
      are iOS/Android only (`docs/ARCHITECTURE.md` §5.3); `apps/web` is the real,
      already-working web surface. iOS/Android bundling itself was confirmed via
      `nx run mobile:build`'s successful Hermes bytecode output for both platforms —
      an actual device/simulator run is outside what this environment can do
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) against the live Dockerized Postgres

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

### Milestone 6

```bash
pnpm exec nx run api:generate-openapi --skip-nx-cache
# ^ first attempt used `tsx` — failed with an esbuild "Parameter decorators only
#   work when experimental decorators are enabled" error, then (after fixing that)
#   an `UndefinedDependencyException` for TokensService's PrismaService param.
#   Root cause: esbuild doesn't implement `emitDecoratorMetadata` at all, which
#   Nest's DI relies on for constructor-injection reflection — no flag fixes this,
#   it's a structural esbuild limitation. Switched to `ts-node` (already a root
#   devDependency) + `tsconfig-paths/register`, which uses the real TypeScript
#   compiler and works correctly. See "Bugs Found" below.

DATABASE_URL="postgresql://baduser:badpass@localhost:1/nonexistent" \
  pnpm exec nx run api:generate-openapi --skip-nx-cache
# ^ deliberately broke DB connectivity to verify the `abortOnError: false` claim
#   empirically rather than trust it by inspection — succeeded, confirming
#   openapi.json generation is genuinely decoupled from Postgres being reachable.

pnpm exec nx run api-client:generate-types --skip-nx-cache
pnpm exec nx run-many -t lint typecheck test build -p api-client --skip-nx-cache
# ^ caught a real @nx/dependency-checks failure on the first pass: my new spec
#   files explicitly `import { ... } from 'vitest'`, but no other package in this
#   repo does that (they rely on vitest's `globals: true` instead) — vitest was
#   never declared as this package's own dependency. Removed the explicit imports
#   to match house style rather than add the dependency; `vi`/`describe`/`it`/
#   `expect` are globally injected the same as everywhere else. 19/19 tests passing.

pnpm exec nx run web:build --skip-nx-cache
# ^ found a real, repo-first bug: apps/web is the first project to import
#   `@instagram-clone/*` packages through Turbopack (apps/api uses webpack, which
#   never hit this). See "Bugs Found" below for the full diagnosis and fix.

pnpm exec nx run-many -t lint typecheck test build -p api,api-client,web,types,validation,config --skip-nx-cache
# ^ re-verified every touched project together after the package.json fix, not
#   just web in isolation — 6/6 projects clean.

# Manual, real-server verification before trusting the Playwright suite (same
# practice as Milestone 5's curl walkthrough): started `api:serve` in the
# background against the live Dockerized Postgres, then:
pnpm exec nx run web-e2e:e2e --skip-nx-cache -- --project=chromium
# ^ 4/4 passing on the first real run: register → /home → already-authenticated
#   /login redirect → logout → /login → unauthenticated /home redirect; a second
#   test logging back in as the same user; a third showing the inline error for a
#   wrong password without leaving the page. Confirmed `proxy.ts` actually ran
#   (visible in the dev-server request log: "proxy.ts: Nms" on every /home request)
#   and stayed fast on the common (not-yet-expired) path.

pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

Background processes (the manually-started `api:serve`, and Playwright's own managed
`web:dev`) were both confirmed stopped afterward — no stray Node processes left
listening on 3000/4200.

### Milestone 7

```bash
pnpm exec expo install expo-secure-store   # run from apps/mobile, per CLAUDE.md
# ^ resolved the SDK-56-compatible version (56.0.4) automatically and registered
#   its config plugin in app.json — no manual version pinning needed.

pnpm exec nx run mobile:test --skip-nx-cache
# ^ first run failed all 3 suites touching @instagram-clone/api-client with
#   "Cannot find module" — apps/mobile's jest.config.cts uses the jest-expo preset
#   directly (needed for the RN environment/transforms) rather than layering on
#   Nx's own jest preset the way apps/api's config does, so it never got the
#   tsconfig-paths-derived moduleNameMapper other projects have. Added explicit
#   entries for all four @instagram-clone/* packages (same fix apps/web's
#   vitest.config.mts already needed, for the same underlying reason — see
#   docs/ARCHITECTURE.md §6). 16/16 passing afterward.

pnpm exec nx run mobile:lint --skip-nx-cache
pnpm exec nx run mobile:build --skip-nx-cache
# ^ first run failed: Metro tried to bundle *.spec.tsx files co-located under
#   src/app/ as if they were routes (Expo Router treats every file under its app
#   root as a route — the exact Milestone-0 bug that moved the original placeholder
#   test out of src/app/ in the first place, reintroduced by co-locating the new
#   screen tests there). Moved all three under src/__tests__/ instead, matching the
#   established precedent. Passing afterward — real Hermes bytecode bundles
#   produced for web/iOS/Android.

pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace

# Manual verification against a real running server (same practice as Milestones
# 5/6): started api:serve against the live Dockerized Postgres and
# `nx run mobile:serve` (expo start --web), then drove the web-exported bundle
# with a throwaway headless-Chromium script (not part of the committed test
# suite — apps/web-e2e's Playwright install, reused directly):
node .tmp-verify-mobile.mjs
# ^ found expo-secure-store has no web implementation at runtime
#   ("ExpoSecureStore.default.getValueWithKeyAsync is not a function") — confirmed
#   this is expected (see Bugs Found below), not something to fix, and not a signal
#   to distrust the unit test suite's coverage of the actual auth logic. Script
#   deleted afterward — it existed only to answer "does the exported bundle even
#   boot," not to become a permanent e2e suite (mobile's test scope per
#   docs/IMPLEMENTATION_PLAN.md M7 is unit tests only).

pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

Both background dev servers (`api:serve`, `mobile:serve`) confirmed stopped
afterward — no stray processes left listening on 3000/8081.

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
  rather than guess. **Update, Milestone 6**: this turned out to be exactly what `web`
  needed too, not just mobile — see that milestone's entry below for why `apps/web`
  ended up reading the body field instead of the API's own cookie after all.

None of Milestone 5's changes touch `docs/DATABASE.md` or `docs/FEATURES.md` — the
`RefreshToken` schema and the auth feature scope were both already fully specified by
Milestones 2 and 3 respectively; this milestone only implements against them.

### Milestone 6

- **`apps/web` keeps its own session cookie; it never reads the API's refresh cookie.**
  The original `docs/ARCHITECTURE.md` §5.1/§7 draft described the Next server reading
  the API's httpOnly cookie via `cookies()`. That can't actually work as drafted: `web`
  and `api` are different origins (different ports in dev; would need a shared parent
  domain in production), and even granting that, the cookie's `Path=/api/v1/auth`
  means the browser only attaches it to requests under that exact path — a Server
  Action POST goes to whatever page it's called from, never `/api/v1/auth/*`, so the
  cookie would never reach `apps/web`'s server regardless of domain sharing. Resolved
  by having `apps/web` call the API server-to-server exactly the way `mobile` will (an
  explicit `refreshToken` in the request body — the Milestone 5 "always include it"
  decision, above, turned out to be load-bearing for exactly this), and keeping its own
  separate session cookie on its own origin. `docs/ARCHITECTURE.md` §5.1/§7 rewritten
  to describe this rather than the unworkable original design.
- **That session cookie stores the access token too, not just the refresh token.**
  `docs/ARCHITECTURE.md` §7's original draft said the access token lives "in memory ...
  only." Next's `cookies()` can only be _written_ from a Server Action or Route
  Handler — never a plain Server Component render — so a design that never persists
  the access token would force a refresh on every single page load that reads session
  state, including plain renders that structurally can't persist the _rotated refresh
  token_ that refresh produces. The next request would then present a refresh token
  the API has already rotated away, tripping reuse-detection (§7) and wrongly
  force-logging out a real user doing nothing wrong. Caching the access token (and its
  expiry) in the same cookie means a plain render can reuse it directly in the common
  case and never needs to write anything.
- **`apps/web/src/proxy.ts` (Next 16's renamed `middleware.ts`) exists specifically to
  keep that cached access token from going stale.** It only refreshes when the cached
  token is actually expired, not on every request — rotating on every request would
  create a real race: two near-simultaneous requests (e.g. a prefetch alongside a
  navigation) reading the same not-yet-rotated cookie value would both try to rotate
  it, and the second to reach the API would see the first's rotation and get flagged
  as reuse. Refreshing only near the token's real ~15-minute expiry reduces this to the
  same rare edge case every refresh-rotation system has (two requests racing in the
  exact instant of expiry) rather than making it happen on every page load.
- **`packages/api-client`'s hand-written transport is typed against
  `packages/validation`'s existing types, not the generated `openapi-types.ts`.** See
  the `docs/API.md` §15 rewrite for the full reasoning — both describe the same shapes
  (the OpenAPI doc is itself derived from those same Zod schemas), so typing the client
  against a second, generated copy would duplicate types for no benefit `web`/`mobile`
  don't already get from depending on `validation` directly. The generated types are
  still genuinely used, just differently: as a compile-time contract check
  (`openapi-contract.spec.ts`) that fails to typecheck if `apps/api` ever stops serving
  a route this client wraps.
- **`openapi.json` and `openapi-types.ts` are both gitignored, regenerated-on-demand
  build artifacts**, not committed files with a CI staleness check as
  `docs/ARCHITECTURE.md` risk #2's original mitigation proposed. Matches the existing
  `prisma/generated/` precedent in this repo, and is simpler: a file that's always
  regenerated fresh can't drift from what generates it, so there's nothing for a
  staleness check to actually catch.
- **`packages/config`/`validation`/`api-client`/`types`' `package.json` no longer
  declares `"type": "commonjs"` at all** (was explicit; now just absent, which is
  CommonJS by Node's own default — a deliberate, narrow fix, not a stray edit). See
  "Bugs Found" below for why this was necessary and why setting it to `"module"`
  instead (the more obvious-looking fix) was tried first and reverted.

None of Milestone 6's changes touch `docs/DATABASE.md` — no schema work this
milestone; `docs/FEATURES.md` didn't need changes either, since "register/login/logout
UI" was already implicit in the auth feature it already describes, not a new scope
decision.

### Milestone 7

- **Both tokens are stored together as one SecureStore item, not two separate
  keys.** `docs/ARCHITECTURE.md` §7's original wording ("both access and refresh
  tokens stored via `expo-secure-store`") didn't specify one item vs two; one JSON
  value mirrors `apps/web`'s own `session-cookie.ts` design (Milestone 6) and means a
  single read/write/delete covers the whole session instead of coordinating three
  independent SecureStore calls that could partially fail.
- **`apiClient` is a module-level singleton on mobile, not built per-call.**
  `apps/web` has to construct a fresh client per request because Next's `cookies()`
  is only valid within a request scope; `expo-secure-store` has no equivalent
  restriction, so building it once at module load (the simpler, more obvious design)
  is correct here rather than something to avoid out of misplaced consistency with
  web's adapter.
- **`apps/mobile`'s web export target doesn't support the auth flow at all** —
  `expo-secure-store` has no web implementation. Not treated as a gap to fill (e.g.
  with a `Platform.OS === 'web'` fallback to `localStorage`): `apps/mobile`'s
  supported targets are iOS/Android only (`docs/ARCHITECTURE.md` §5.3 never claimed
  web), and `apps/web` already is the real, secure web surface — adding a second,
  less-secure browser-storage path for mobile's incidental web export would be net
  new complexity solving a problem nobody has. Recorded here rather than left
  silently broken.

None of Milestone 7's changes touch `docs/DATABASE.md` or `docs/API.md` — no schema
or endpoint work; `docs/FEATURES.md` needed no changes for the same reason as
Milestone 6.

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

### Milestone 6

14. **`esbuild` (and therefore `tsx`) doesn't implement `emitDecoratorMetadata`.**
    `generate-openapi.ts` first tried running under `tsx` — it failed first with
    "Parameter decorators only work when experimental decorators are enabled" (fixed
    by pointing `tsx --tsconfig` at `apps/api/tsconfig.app.json`, which actually has
    that option), then, once that parsed, with a NestJS
    `UndefinedDependencyException` for `TokensService`'s `PrismaService` constructor
    param — the class reference itself was `undefined` at runtime. Root cause: Nest's
    DI resolves constructor-injected types via TypeScript's `emitDecoratorMetadata`
    (`design:paramtypes` reflection), which esbuild structurally does not implement —
    no flag fixes this, since esbuild never type-checks and that metadata comes from
    the type checker. Switched the script's runner from `tsx` to `ts-node` (already a
    root devDependency, unused until now) + `tsconfig-paths/register` for path-alias
    resolution — `ts-node` uses the real TypeScript compiler, so decorator metadata
    emits correctly. Worth remembering for any future "run a NestJS-DI-aware script
    directly" need in this repo: `tsx`/esbuild cannot do it, `ts-node` can.
15. **Turbopack rejects `apps/web`'s import of any `@instagram-clone/*` package**,
    with "Specified module format (CommonJs) is not matching the module format of the
    source code (EcmaScript Modules)." `apps/api`'s webpack build never hit this
    (`ts-loader` transpiles to CJS before webpack's own module-format detection runs),
    but Turbopack resolves straight to these packages' `.ts` **source** via the
    `tsconfig.base.json` path aliases (docs/ARCHITECTURE.md §6) and, uniquely among
    this repo's build tools, checks the resolved file's package.json `"type"` field
    against what the source actually looks like — every one of these packages
    declared `"type": "commonjs"` while their source uses `import`/`export` syntax
    (completely normal, unbuilt TypeScript), and Turbopack treats that as a hard
    conflict rather than inferring from content. First fix attempted, `transpilePackages`
    in `next.config.js` (the standard Next.js mechanism for "these workspace packages
    need my own compiler"), did **not** help — it appears to key off node*modules
    package resolution, which the tsconfig path aliases bypass entirely. Setting
    `"type": "module"` instead of removing it was tried next and immediately broke a
    \_different* thing: `apps/api`'s new `ts-node`-run `generate-openapi.ts` started
    failing with `ERR_REQUIRE_ESM`, since `ts-node`'s CJS `require()` can't load a
    package that now declares itself ESM. The fix that actually worked and broke
    nothing else: remove the `"type"` field **entirely** from
    `packages/{config,validation,api-client,types}/package.json` rather than setting
    it to either value — Node's own default (`"commonjs"` when unspecified) satisfies
    `ts-node`, and Turbopack, with nothing explicit to conflict against, correctly
    infers ESM from the source and stops erroring. Verified by rebuilding **both**
    `apps/api` (`generate-openapi`, `build`, `test`) and `apps/web` (`build`, `test`)
    together afterward, not just the one that was failing at the time — this is
    exactly the kind of cross-project ripple a narrower fix could have silently
    reintroduced elsewhere. Worth remembering if a future package.json edit
    re-adds an explicit `"type"` field here "for clarity": it will break one of these
    two apps depending on which value is chosen.

### Milestone 7

16. **`apps/mobile`'s Jest config never got the `@instagram-clone/*` module mapping
    other projects have.** `jest.config.cts` sets `preset: 'jest-expo'` directly
    (required for the React Native test environment/transforms) instead of extending
    `jest.preset.js` the way `apps/api`'s config does — so it never picked up
    Nx's tsconfig-paths-derived `moduleNameMapper`, and every test importing
    `@instagram-clone/api-client` failed with "Cannot find module." Same underlying
    cause as `apps/web`'s Milestone-0 `vitest.config.mts` needing explicit aliases
    (bare-specifier resolution for these packages goes through `node_modules`, which
    points at unbuilt `dist/` output). Fixed with explicit `moduleNameMapper` entries
    for all four `@instagram-clone/*` packages.
17. **Co-locating the new screen tests under `src/app/` reintroduced the exact bug
    Milestone 0 already fixed once** (see bug #3 above): Expo Router treats every
    file under its app root as a route, so `*.spec.tsx` files there get bundled as
    screens, pulling in `@testing-library/react-native` → Node's `console` module,
    which Metro can't resolve, breaking `expo export` entirely. Moved all three new
    spec files to `src/__tests__/` instead, matching the precedent the original fix
    already established — worth remembering as a standing rule for this app, not
    just a one-time fix: **no test files under `apps/mobile/src/app/`, ever.**
18. **`expo-secure-store` has no web implementation** — confirmed empirically (not
    assumed) via a real headless-browser run against the web-exported bundle, which
    threw `ExpoSecureStore.default.getValueWithKeyAsync is not a function` the moment
    a screen tried to read the session. Not a bug to fix (see the Deviations entry
    above) — recorded here so the _symptom_ is recognizable if it resurfaces, since
    the error message alone doesn't obviously point at "this platform isn't
    supported" without this context.

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
- **`apps/web-e2e:e2e` needs `apps/api` running against the live Dockerized Postgres**,
  same as `apps/api-e2e:e2e` — Playwright's own `webServer` config only manages
  `web:dev` automatically. Start `nx run api:serve` first (or have it already running)
  before running the web e2e suite; there's no CI pipeline yet to automate this
  (explicitly scoped to Milestone 20, per the note under Milestone 2 above).
- **`proxy.ts`'s refresh-on-expiry still has a narrow, inherent race window**: two
  requests arriving in the exact instant a session's access token expires could both
  read the same not-yet-refreshed cookie and both attempt to refresh, and the second to
  reach the API would see the first's rotation and get flagged as reuse, logging that
  user out. This is a known characteristic of refresh-token rotation in general (not
  specific to this implementation) and is now a rare edge case rather than the
  every-request occurrence an earlier design would have had (see the Milestone 6
  deviation above) — revisit only if real usage shows this happening in practice; a
  short server-side grace period on the immediately-prior token is the standard fix if
  so, and isn't implemented today.
- **Web session cookies are per-browser, not per-device-and-revocable-individually
  from the UI** — logging out revokes via the API (which does support "all devices"),
  but there's no account-settings surface yet to list/revoke individual sessions. Not
  in Milestone 6's scope (`docs/IMPLEMENTATION_PLAN.md` M19, Account Settings, is where
  session management as a _feature_ belongs); noted here only so it isn't mistaken for
  an oversight in the auth architecture itself.
- **`apps/mobile`'s web export target is not a functional surface** — `expo-secure-
store` has no web implementation (Milestone 7, confirmed empirically). This is
  expected and not planned to be fixed: `apps/mobile`'s supported targets are
  iOS/Android only, and `apps/web` already covers the web surface properly. Worth
  knowing if anyone ever runs `nx run mobile:serve`/`start --web` expecting the auth
  screens to work in a browser — they won't, by design.
- **Mobile auth screens were verified by unit tests (mocked SecureStore/API) and a
  one-off manual run against the web export only** — no real iOS/Android
  simulator/device run happened this milestone, since this environment can't drive
  one. `expo export`'s successful Hermes bytecode output for both platforms is real
  signal that the JS bundle is structurally sound, but genuine on-device SecureStore
  behavior (Keychain/Keystore prompts, permission handling) remains unverified
  beyond what the mocked unit tests assert. Worth a real device/simulator pass before
  treating mobile auth as production-ready.

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
trigger, not left open. Milestone 6's six deviations (web's own session cookie instead
of sharing the API's, caching the access token alongside it, `proxy.ts`'s
refresh-only-when-expired design, typing `api-client` against `validation` instead of
the generated OpenAPI types, gitignoring both codegen artifacts instead of committing
them, and removing the shared packages' `"type"` field) are likewise each decided and
recorded above with rationale, not left open. Milestone 7's three deviations
(one combined SecureStore item instead of two, a module-level `apiClient` singleton
instead of web's per-request pattern, and deliberately not fixing the unsupported web
export target) are equally settled, not open questions. Everything else recorded in
this file is
implementation-detail-level — versions, ports, a webpack externals list, one deferred
column, one simplified index, two deferred extensions — with rationale in
`docs/DATABASE.md` and `docs/ARCHITECTURE.md` where it touches those docs. None of it
changes anything either document asserts at the design level.

---

## Next Milestone

**Milestone 8 — User Profiles (read + edit, no photo upload yet)**: per
`docs/IMPLEMENTATION_PLAN.md`, the first _product_ feature endpoints — everything
through Milestone 7 has been infrastructure and auth. `User` (Milestone 2) and the
auth plumbing (Milestones 5–7) already carry everything this milestone needs; no new
tables.

1. API: `GET /users/:username` (public profile — `docs/API.md` §4's wider schema than
   auth's own `UserResponseSchema`: avatar, follower counts, `isFollowedByMe` — the
   last two are placeholder-shaped until Follows (Milestone 10) is real, so decide
   explicitly whether they're `0`/`false` stubs or omitted; don't guess silently),
   `GET /users/:username/posts` (returns empty — `Post` doesn't exist until Milestone
   11), `PATCH /me` (edit own profile: `fullName`/`bio`/`websiteUrl`/`isPrivate`).
2. Web + mobile: a profile view screen and an edit-profile form. `isPrivate`'s toggle
   is present but inert — it has no follow-approval effect yet (`docs/FEATURES.md`
   #17 cites its actual scope note under Feature 5, Follow/Unfollow — re-read that
   before wiring the toggle up) — don't build private-post visibility gating this
   milestone, that's not what "inert" is asking for.
3. **Tests**: integration tests for profile read/update, including that a
   private-field update attempted by a non-owner is rejected (`403`); Playwright
   (`apps/web-e2e`) covers viewing and editing your own profile, extending the
   register→login pattern Milestone 6 already established rather than inventing a new
   one.

Before starting it: re-read `docs/IMPLEMENTATION_PLAN.md`'s Milestone 8 section,
`docs/API.md` §4 (Users & Profiles) in full, and `docs/FEATURES.md` #17's exact
wording on the private-account toggle's current scope. Worth noting going in: this is
the first milestone since Auth to touch `apps/web` and `apps/mobile` together for a
non-auth feature — `packages/api-client`'s `auth` namespace (Milestones 6–7) is the
template for a new `users` namespace (`AuthClient`'s shape — typed against
`packages/validation`, not the generated OpenAPI types, per the Milestone 6 deviation
above — is the pattern to repeat, not reinvent). Also worth checking before designing
the edit form: `PATCH /me` needs a guard requiring a valid access token
(`JwtAuthGuard`, Milestone 5) — this is the first non-auth endpoint to need one, so
it's the first real proof that guard generalizes past the one route it was built for.
