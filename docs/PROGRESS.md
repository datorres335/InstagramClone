# Project Progress

This file tracks the current implementation status of the Instagram clone.

It should be updated after every completed milestone or meaningful development session.

---

## Current Status

**Phase:** Core Features
**Current Milestone:** Milestone 10 — Follow / Unfollow
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
it fresh (Milestone 6). `apps/mobile` has the same treatment: register, login, and a
minimal authenticated tab shell, backed by an `expo-secure-store` `TokenStorage`
adapter that proved out the storage-adapter abstraction on its second, structurally
different implementation with zero changes to the shared transport (Milestone 7). The
three seed users (`alice`/`bob`/`carol`, Milestone 2) can now log in through either real
UI, not just `curl`. Milestone 8 is `apps/api`'s second domain module and this repo's
first genuine _product_ feature (everything before it was infrastructure or auth):
`UsersModule` implements `GET /users/:username` (public, optionally-authenticated
profile view), `GET /users/:username/posts` (always empty until Milestone 11), and
`PATCH /me` (edit own profile) — with real profile-view and edit-profile screens on
both `web` and `mobile`, and a new `OptionalAuthGuard` (docs/ARCHITECTURE.md §7) proven
out as the first thing besides `JwtAuthGuard` that other domain modules import from
`AuthModule`. Milestone 9 gives `apps/api` its first background-job pipeline: a new
`Media` table (`purpose`/`status`/`storageKey`/`variants`/`blurhash`, plus the
`User.avatarMediaId` FK deferred to this exact migration back in Milestone 2),
`POST /media/presign` → direct client `PUT` to MinIO → `POST /media/:id/complete` →
an in-process BullMQ `MediaProcessor` (`sharp` variants + a blurhash) → `GET /media/:id`
polling, and `PATCH /me/avatar` wiring the finished piece into `UsersModule`. `GET
/users/:username`'s `avatarUrl` resolves for real now, no longer a hardcoded `null`.
Both `web` and `mobile` gained a "change photo" affordance on their Milestone 8
profile-edit screens, running the full presign→upload→poll→set-avatar flow against the
real API. Milestone 10 adds `apps/api`'s third domain module, `FollowsModule`: a new
`Follow` table (a self-referential many-to-many on `User`, composite PK, a hand-added
`CHECK` constraint against self-follows), `PUT`/`DELETE /users/:username/follow`
(idempotent either way), and `GET /users/:username/followers`/`following` — the
**first real cursor-pagination implementation** in this codebase (`GET
/users/:username/posts` since Milestone 8 always returns an empty page, so it never
actually needed one). `PublicProfileResponse`'s `followersCount`/`followingCount`/
`isFollowedByMe` are all real now, not hardcoded stubs. Both `web` and `mobile` gained
a Follow/Unfollow button on profile views and new followers/following list
screens with an inline follow/unfollow affordance per row. No Post/feed features exist
yet — `postsCount` stays a stub until Milestone 11.

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

### Milestone 8 — User Profiles

- [x] `apps/api/src/modules/auth/resolve-authenticated-user.ts` — extracted the
      shared verify-token-and-look-up-user logic behind both `JwtAuthGuard` (rejects
      on failure) and the new `OptionalAuthGuard` (proceeds either way), so the two
      can't silently drift on what "a valid token" means
- [x] `OptionalAuthGuard` + `@OptionalCurrentUser()` (`apps/api/src/modules/auth/`) —
      for routes that behave differently when authenticated but don't require it;
      never throws. `AuthModule` now exports `JwtModule` itself alongside both guards
      — exporting only the guard classes wasn't enough for cross-module reuse to work
      (see Bugs Found below)
- [x] `packages/validation`'s `src/lib/profile.ts` — `publicProfileResponseSchema`
      (the wider public-profile shape `docs/API.md` §3's own note already promised:
      avatar/counts/`isFollowedByMe`, never `email`), `updateProfileInputSchema` (a
      real PATCH shape — every field optional and independently nullable, so `null`
      clears a field and `undefined`/omitted leaves it untouched), and
      `userPostsResponseSchema` (`data: z.array(z.never())` — honest at the type
      level that this endpoint can only ever return an empty page today)
- [x] `packages/validation`'s `src/lib/pagination.ts` — `paginationQuerySchema`
      (`cursor`/`limit`, defaults/max matching `docs/API.md` §1), the first
      genuinely shared pagination schema, ready for every future list endpoint
- [x] `apps/api/src/modules/users/` — `UsersModule` (`UsersController` for
      `/users/*`, `MeController` for `/me/*`, split because they're different
      resource bases per `docs/API.md` §2 even though both live in this module),
      `UsersService`, DTOs, and a `profile-response.mapper.ts` mirroring auth's own
      `user-response.mapper.ts` (moved to `common/mappers/` this milestone, now that
      two domain modules share it)
- [x] All three endpoints wired: `GET /users/:username` (public profile, optional
      auth), `GET /users/:username/posts` (always an empty page — `Post` doesn't
      exist until Milestone 11), `PATCH /me` (edit own profile, required auth)
- [x] `packages/api-client`'s `users` namespace (`getProfile`/`getPosts`/
      `updateProfile`) and a new `HttpClient.optionallyAuthorizedRequest` call shape
      mirroring the API's own `OptionalAuthGuard` — attaches a token if one exists,
      never requires one, no retry-on-401 (this class of route can't reject for auth
      reasons, so a 401 here would mean something else is genuinely wrong)
- [x] `apps/web`: `(app)/[username]/page.tsx` (profile view — the same page for your
      own profile and anyone else's, differing only in whether "Edit profile"
      renders) and `(app)/profile/edit/page.tsx` (a Server Action + `useActionState`
      form, matching Milestone 6's auth-form pattern exactly); a "View profile" link
      added to `/home`
- [x] `apps/mobile`: `app/profile/[username].tsx` (the same shared-view-screen
      pattern as web), `app/profile/edit.tsx`, and a new `(tabs)/profile` tab that's
      just a thin `<Redirect>` to `/profile/<your own username>` — reusing the one
      view screen for "my profile" instead of maintaining a second copy
- [x] Deliberately **no Follow/Unfollow button** on the profile view yet, on either
      platform — `docs/FEATURES.md` #3 describes one, but `Follow` doesn't exist
      until Milestone 10; adding a button with nothing behind it would be dead UI,
      not a feature
- [x] 51 new/updated unit tests: 20 in `packages/validation` (`profile.spec.ts`,
      `pagination.spec.ts`), 14 in `apps/api` (`optional-auth.guard.spec.ts`,
      `users.service.spec.ts`), 7 in `packages/api-client` (`users-client.spec.ts`),
      and 10 in `apps/mobile` (`profile-view.spec.tsx`, `profile-tab.spec.tsx`,
      `profile-edit.spec.tsx`, under `src/__tests__/` — never `src/app/`, see Bugs
      Found in Milestone 7's entry for why)
- [x] 21 `apps/api-e2e` integration tests total (10 new in `users/profile.spec.ts`,
      sharing 3 registered users across the whole file via `beforeAll` rather than
      one per test — see Bugs Found below for why that matters) and 10
      `apps/web-e2e` Playwright tests total (6 new in `profile.spec.ts`): viewing an
      empty-state own profile, editing and persisting every field including a
      full-page reload to prove it's server-side, pre-fill on a second visit,
      redirect-to-login for an unauthenticated edit attempt, read-only viewing of
      someone else's profile with no edit link, and a real `404` for an unknown
      username
- [x] Full validation passing: `nx run-many -t lint typecheck test build` (11/11
      projects) + `api-e2e:e2e` (7/7 suites) + `web-e2e:e2e` (10/10, Chromium)
      against the live Dockerized Postgres and real running `api`/`web` servers

### Milestone 9 — Media Pipeline

- [x] `prisma/schema.prisma` — `Media` model (`docs/DATABASE.md` §3.3:
      `ownerId`/`purpose`/`status`/`storageKey`/`variants` jsonb/`width`/`height`/
      `blurhash`/`byteSize`/`contentType`/`failureReason`), `MediaPurpose`/`MediaStatus`
      enums, and `User.avatarMediaId` (`@unique`, `onDelete: SetNull`) — the FK
      explicitly deferred to this exact migration back in Milestone 2. Applied via a
      hand-placed migration folder (`prisma migrate diff --script` + `migrate deploy`
      — see Bugs Found below for why `migrate dev` itself doesn't work here) and
      verified byte-for-byte against the live schema with `psql \d`
- [x] `apps/api/src/storage/` — `StorageModule`/`StorageService`, a global infra
      module (same convention as `config`/`prisma`) wrapping the AWS SDK v3 S3
      client: presigned `PUT` URL generation, `HEAD`-based existence checks, buffer
      reads/writes for the processor, and public-URL resolution (the bucket is
      public-download, so no signed `GET` URLs are needed)
- [x] `apps/api/src/modules/media/` — `MediaModule`/`MediaController`/`MediaService`,
      Zod DTOs (`packages/validation`'s new `media.ts`), and `MediaProcessor` (a
      `@nestjs/bullmq` `@Processor`/`WorkerHost`, registered inside `MediaModule`
      itself, in-process — the already-documented `docs/ARCHITECTURE.md` §8/risk #4
      trade-off, not a new decision). `generateMediaVariants`
      (`media-variants.ts`) is a pure function with no S3/Prisma/BullMQ knowledge —
      `sharp` for `thumbnail` (150×150, always center-cropped square) and `feed`
      (≤1080px, aspect-preserved), `blurhash` for a progressive-loading placeholder —
      kept separate specifically so it's unit-testable in isolation
- [x] Three endpoints wired: `POST /media/presign` (server-enforced ≤8MB / allowed
      content-type limits — `413`/`400`, never trusting client-declared values),
      `POST /media/:id/complete` (`HEAD`s the bucket, enqueues the processing job,
      idempotent on repeat calls), `GET /media/:id` (poll status) — all
      ownership-checked (`403`/`404`) via a shared `getOwnedMedia` helper
- [x] `PATCH /me/avatar` wired into the existing `MeController`/`UsersModule` from
      Milestone 8 — validates the media is the caller's own, `READY`, and
      `AVATAR`-purpose (`422 media-not-ready` otherwise, docs/API.md §14) before
      setting `User.avatarMediaId`; returns the `Media` resource, not `UserResponse`
      (see Deviations below for why)
- [x] `UsersService.getPublicProfile` now resolves a real `avatarUrl` via
      `MediaService.resolveAvatarUrl` (the `avatarMedia` relation, included in the
      Prisma query) instead of the Milestone 8 hardcoded `null`
- [x] `packages/validation`'s new `media.ts` (`mediaPurposeSchema`/`mediaStatusSchema`/
      `presignMediaInputSchema`/`presignMediaResponseSchema`/`mediaVariantsSchema`/
      `mediaResponseSchema`/`updateAvatarInputSchema`) and `packages/api-client`'s new
      `media` namespace (`presign`/`complete`/`getById`/`uploadToPresignedUrl`/
      `waitUntilProcessed` — the poll loop lives here once, shared by both apps) plus
      `users.updateAvatar`
- [x] `apps/web`: an `AvatarUploader` client component on the Milestone 8 profile-edit
      screen — file input → Server Actions (`avatar-actions.ts`, since only a Server
      Action can read the session cookie) for presign/complete/poll/set-avatar → a
      direct browser `PUT` straight to the presigned MinIO URL, never proxied through
      Next. No client-side crop widget (see Deviations below)
- [x] `apps/mobile`: the same flow on the Milestone 8 edit screen, but simpler — the
      whole app is already "client-side," so `apiClient.media.*`/`updateAvatar` are
      called directly, no Server Action indirection needed. `expo-image-picker`
      (`allowsEditing`/`aspect: [1,1]`) provides the real client-side square crop
      docs/FEATURES.md #4 originally asked for
- [x] 46 new/updated unit tests: 5 `media-variants.spec.ts` (dimensions/aspect-ratio/
      blurhash, against real `sharp`-generated fixture buffers, not mocked), 19
      `media.service.spec.ts` + updated `users.service.spec.ts` (`apps/api`), 7
      `media-client.spec.ts` + an `updateAvatar` case in `users-client.spec.ts`
      (`packages/api-client`), 9 new cases in `apps/mobile`'s `profile-edit.spec.tsx`
- [x] 6 new `apps/api-e2e` integration tests (`media/media-pipeline.spec.ts`) —
      **against the real running MinIO/Redis/BullMQ, not mocked**: a full
      presign→direct-`PUT`→complete→real-BullMQ-processing→`READY` run that then
      fetches the actual variant URLs and re-decodes them with `sharp` to confirm
      real dimensions, plus `setAsAvatar`→`GET /users/:username` persistence,
      `422`/`403`/`413`/`401` negative paths
- [x] 2 new `apps/web-e2e` Playwright tests (`avatar.spec.ts`, Chromium) — a real
      browser file upload through the whole flow against the real API/MinIO/Redis,
      and a client-side content-type rejection
- [x] Full validation passing: `nx run-many -t lint test build` (11 projects) +
      `api-e2e:e2e` (8/8 suites, 27/27 tests) + `web-e2e:e2e` (Chromium) against the
      live Dockerized Postgres/MinIO/Redis and real running `api`/`web` servers

### Milestone 10 — Follow / Unfollow

- [x] `prisma/schema.prisma` — `Follow` model (`docs/DATABASE.md` §3.6:
      composite PK `(followerId, followingId)`, a secondary
      `(followingId, followerId)` index for the followers-list/count direction,
      `onDelete: Cascade` on both FKs) and the reverse `User.following`/
      `User.followers` relations. The `followerId <> followingId` `CHECK`
      constraint was hand-added to the migration SQL — Prisma's schema DSL has
      no portable `@@check` attribute (same class of gap as Milestone 9's
      media migration needing hand edits, different cause)
- [x] `apps/api/src/common/pagination/cursor.ts` — `encodeCursor`/`decodeCursor`,
      the **first real implementation** of the opaque base64
      `(createdAt, id)`-pair cursor `docs/API.md` §1 has described since the
      design phase (`GET /users/:username/posts`, Milestone 8, never needed one
      — always an empty page). Deliberately just encode/decode, not a generic
      Prisma `where`-clause builder — see the file's own doc comment for why
- [x] `apps/api/src/modules/follows/` — `FollowsModule`/`FollowsController`/
      `FollowsService`, `apps/api`'s third domain module. `follow`/`unfollow`
      are idempotent (`upsert`/`deleteMany`); `getFollowers`/`getFollowing` do
      real keyset pagination (`ORDER BY createdAt DESC, <other-id> DESC`,
      `take: limit + 1` to detect a next page) with a single extra query per
      page for the whole page's `isFollowedByMe`, not one per row
- [x] Four endpoints wired: `PUT`/`DELETE /users/:username/follow` (self-follow
      → `409`, nonexistent target → `404`), `GET /users/:username/followers`/
      `following` (optional auth, `400` for a malformed cursor)
- [x] `UsersService.getPublicProfile` now resolves real
      `followersCount`/`followingCount`/`isFollowedByMe` via
      `FollowsService.getFollowCounts`/`isFollowing` — `UsersModule` imports
      `FollowsModule` (not the reverse), the same dependency shape
      `MediaService`/`avatarUrl` established in Milestone 9
- [x] `packages/validation`'s new `follow.ts` (`followListItemSchema`,
      narrower than `PublicProfileResponse` — no `bio`/`websiteUrl`/counts, per
      `docs/FEATURES.md` #6) and `packages/api-client`'s new `follows`
      namespace (`follow`/`unfollow`/`getFollowers`/`getFollowing`).
      `buildQueryString` (cursor/limit query-string serialization) extracted
      out of `users-client.ts` into its own shared file — the second consumer
      crossed this codebase's own "duplicate until a second real consumer
      exists" threshold
- [x] `apps/web`: a `FollowButton` client component (Server Actions for the
      actual `PUT`/`DELETE`, `router.refresh()` after a successful toggle to
      re-fetch the surrounding page's counts) on the profile view page, plus
      new `[username]/followers/page.tsx` and `[username]/following/page.tsx`
      list pages sharing a `FollowListItem` row component
- [x] `apps/mobile`: the same Follow/Unfollow button directly on
      `profile/[username].tsx` (no Server Action indirection needed — see
      Milestone 9's equivalent note on `apiClient` being directly callable),
      new flat `profile/followers.tsx`/`following.tsx` screens (reached via
      `router.push` with `username` as a param, not nested under
      `[username]/` — see Deviations below) sharing a
      `components/follow-list-item.tsx` row component
- [x] 25 new/updated unit tests: 8 `cursor.spec.ts` + `follows.service.spec.ts`
      (19 across both) in `apps/api`, 6 `follows-client.spec.ts` +
      `follow.spec.ts` in `packages/validation`/`packages/api-client`, plus
      updated `profile-view.spec.tsx` (10 new follow/unfollow and
      followers/following-navigation cases) and a new 6-test
      `follow-lists.spec.tsx` in `apps/mobile`
- [x] 11 new `apps/api-e2e` integration tests (`follows/follows.spec.ts`) —
      against the real Dockerized Postgres, not mocked: follow/idempotent
      repeat/404-on-nonexistent-target, self-follow `409`, unauthenticated
      `401`, unfollow/idempotent repeat, real follower/following count
      changes, a genuine keyset-paginated followers list (`limit=2` across 3
      real followers, a real `nextCursor` consumed on the second page),
      `isFollowedByMe` computed correctly for both an authenticated and an
      anonymous viewer, `404`s for a nonexistent target's lists, and a `400`
      for a malformed cursor
- [x] 3 new `apps/web-e2e` Playwright tests (`follows.spec.ts`, Chromium) — a
      real browser follow→count/button update→reload-persists→unfollow round
      trip, confirming no follow button renders on your own profile, and the
      followers list's inline button reflecting a real per-row viewer
      relationship
- [x] Full validation passing: `nx run-many -t lint test build` (11 projects) +
      `api-e2e:e2e` (9/9 suites, 38/38 tests) + `web-e2e:e2e` (15/15,
      Chromium) against the live Dockerized Postgres and real running
      `api`/`web` servers

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

### Milestone 8

```bash
pnpm exec nx run validation:test --skip-nx-cache   # new profile.ts/pagination.ts schemas, 20 new tests, passing first try

pnpm exec nx run api:build --skip-nx-cache && pnpm exec nx run api:lint --skip-nx-cache
# ^ both clean on the first pass.

# Manual verification against the real running server + live Dockerized Postgres
# (same practice as every milestone since M5) — booted api:serve, then curl'd:
# register → GET /users/:username unauthenticated (isFollowedByMe: null) →
# GET /users/:username authenticated as a second user (isFollowedByMe: false) →
# GET /users/:username/posts (empty) → GET /users/does-not-exist (404) →
# PATCH /me with real values → unauthenticated PATCH /me (401) → PATCH /me with an
# invalid websiteUrl (400) → PATCH /me with bio: null (clears it) → re-fetched the
# public profile to confirm every change actually persisted, not just echoed back.
# This is what caught the OptionalAuthGuard/JwtModule cross-module DI bug below —
# the unit tests (which construct guards directly, bypassing Nest's module
# resolution) couldn't have caught it; only booting the real app could.

pnpm exec nx run api-e2e:e2e --skip-nx-cache
# ^ first run: 3 of 7 suites failed with 429 (Too Many Requests) — the existing auth
#   suites and the new 10-registration profile.spec.ts were all competing for the
#   same 10-req/min-per-IP throttle on /auth/register (docs/API.md §1). Rewrote
#   profile.spec.ts to share 3 users across the whole file via beforeAll instead of
#   registering fresh per test (10 registrations → 3). 7/7 suites, 21/21 tests
#   passing afterward, confirmed stable across two consecutive full runs.

pnpm exec nx run web:build --skip-nx-cache   # new /[username] and /profile/edit routes both compiled as dynamic (ƒ) routes, as expected
pnpm exec nx run-many -t lint test -p web,web-e2e --skip-nx-cache
# ^ one lint error: an inline `import('@playwright/test').Page` type annotation in
#   profile.spec.ts tripped @typescript-eslint/consistent-type-imports. Fixed with a
#   top-level `import { type Page } from '@playwright/test'` instead.

pnpm exec nx run api:serve --configuration=development   # backgrounded
pnpm exec nx run web-e2e:e2e --skip-nx-cache -- --project=chromium
# ^ 10/10 passing on the first real run once the lint fix landed.

pnpm exec nx run mobile:test --skip-nx-cache
# ^ first run: 25/26 passing, one failure — a mocked `Link` component returning its
#   children as a bare string (`({children}) => children`) instead of wrapping them
#   in `<Text>`, so React Native Testing Library's `getByText` couldn't find "Edit
#   profile" in the tree even though it was visibly there in the debug output. Fixed
#   by wrapping the mock's return in `<Text>` (`jest.requireActual('react-native')`
#   inside the mock factory, since `jest.mock()` factories can't close over
#   top-of-file imports). 26/26 passing afterward.

pnpm exec nx run mobile:lint --skip-nx-cache
# ^ one warning: an eslint-disable comment for a rule that isn't configured in this
#   project (`react/no-unstable-nested-components`) — removed the unnecessary directive.

pnpm exec nx run mobile:build --skip-nx-cache   # web/iOS/Android Hermes bundles all succeeded

pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # 11/11 projects, whole workspace
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
pnpm exec nx run-many -t lint typecheck test build --skip-nx-cache   # re-verified 11/11 clean after the formatting pass
pnpm exec nx run api-e2e:e2e --skip-nx-cache        # re-verified 7/7 suites, 21/21 tests
pnpm exec nx run web-e2e:e2e --skip-nx-cache -- --project=chromium   # re-verified 10/10
```

Both background dev servers (`api:serve`, `web:dev`) confirmed stopped afterward — no
stray processes left listening on 3000/4200.

### Milestone 9

```bash
pnpm exec nx run validation:test   # new media.ts schemas, passing first try
pnpm exec tsc --noEmit -p apps/api/tsconfig.app.json   # clean
pnpm exec tsc --noEmit -p packages/validation/tsconfig.lib.json   # clean
pnpm exec tsc --noEmit -p packages/api-client/tsconfig.lib.json   # clean

pnpm exec nx run api-client:generate-types   # confirms apps/api's new module graph
# boots cleanly for OpenAPI introspection (no DATABASE_URL needed) — all 4 new
# routes (/me/avatar, /media/presign, /media/:id/complete, /media/:id) appeared
# in the generated openapi-types.ts on the first run.

pnpm exec nx run api:test
# ^ first run failed to even parse: "@nestjs/bullmq" ships ESM-only (no CJS
#   build) — see Bugs Found below. Fixed via jest.config.cts's
#   transformIgnorePatterns. 74/74 passing afterward (31 of them new:
#   media-variants.spec.ts, media.service.spec.ts, users.service.spec.ts).

pnpm exec nx run api:build   # webpack compiled successfully
pnpm exec nx run api:lint    # clean

pnpm exec nx run api-e2e:e2e   # against the real running MinIO/Redis in Compose
# ^ new media-pipeline.spec.ts's own 6 tests passed standalone on the first run —
#   real presign → real MinIO PUT → real HEAD-confirm → real BullMQ job → real
#   sharp processing → real variant GETs re-decoded to confirm actual dimensions.
#   Running the *whole* api-e2e suite together, though: 4/6 of that file's tests
#   429'd — the suite's shared /auth/register budget (Milestone 8, bug #20) was
#   already at exactly 10/10 before this file existed. Reduced this file's own
#   registrations to 2 (shared owner/intruder via beforeAll, matching the M8
#   pattern) and, since that alone wasn't enough headroom, raised the
#   register-specific throttle from 10 to 20/min/IP (see Deviations below — this
#   revisits, not repeats, M8's "not worth loosening the throttle" call). 8/8
#   suites, 27/27 tests passing afterward, confirmed stable across two runs.

pnpm exec nx run mobile:test --testPathPatterns=profile-edit
# ^ first run: 1 failure — an exact-text assertion mismatch against the real
#   rendered error string (missing the trailing period). Fixed the test
#   assertion, not the component. 9/9 passing afterward.
pnpm exec nx run mobile:test   # 31/31, whole project
pnpm exec nx run mobile:lint   # clean

pnpm exec tsc --noEmit -p apps/mobile/tsconfig.app.json
# ^ found a real, pre-existing bug unrelated to this milestone's own changes:
#   apps/mobile/src/app/profile/[username].tsx imported `PublicProfileResponse`
#   from `@instagram-clone/api-client`, which never exported it (it's a
#   `@instagram-clone/validation` type) — this file had apparently never been
#   typechecked standalone before. Fixed the import; not otherwise this
#   milestone's concern, but left broken would have blocked a clean typecheck
#   pass going forward.

pnpm exec nx run web:build   # Next build compiled + typechecked cleanly,
# /profile/edit still a dynamic (ƒ) route as expected
pnpm exec nx run-many -t lint test --projects=web   # clean

pnpm exec nx run api:serve --configuration=development   # backgrounded
pnpm exec nx run web-e2e:e2e --grep=avatar
# ^ Chromium: 2/2 passing on the first real run (a genuine browser file upload
#   through the whole presign→PUT→complete→poll→set-avatar flow, then a reload
#   to prove server-side persistence). Firefox/WebKit failed with "Executable
#   doesn't exist" — confirmed pre-existing (Milestone 8's Known Issues already
#   notes these browsers were never installed in this environment; the
#   pre-existing profile.spec.ts fails identically), not something this
#   milestone introduced or needs to fix.

pnpm exec nx run-many -t lint test build   # 28/28 tasks, whole workspace
pnpm exec prettier --write "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}"
pnpm exec nx run-many -t lint test build --projects=api,api-client,validation,web,mobile
# ^ re-verified clean after the formatting pass
pnpm exec nx run api-e2e:e2e        # re-verified 8/8 suites, 27/27 tests
```

Both background `api:serve` instances confirmed stopped afterward — no stray processes
left listening on 3000.

### Milestone 10

```bash
pnpm exec prisma validate --config prisma.config.ts   # clean after adding Follow
pnpm exec prisma migrate diff --from-config-datasource \
  --to-schema=prisma/schema.prisma --script --config prisma.config.ts \
  > prisma/migrations/20260929203726_0003_follow/migration.sql
# ^ hand-added the CHECK constraint afterward (Prisma has no @@check attribute)
pnpm exec prisma migrate deploy --config prisma.config.ts   # applied cleanly
# Verified against the live schema: psql \d follows — composite PK, secondary
# index, CHECK constraint, both FKs all matched the schema.prisma design exactly.

pnpm exec tsc --noEmit -p apps/api/tsconfig.app.json
# ^ two `noUncheckedIndexedAccess` errors on `page[page.length - 1]` in
#   FollowsService.toListResponse — fixed with `page.at(-1)` + a null guard.
#   Clean afterward.

pnpm exec nx run api:test --testPathPatterns="follows|cursor"   # 19/19, first
# real run after the indexed-access fix — no other failures.
pnpm exec nx run api:test --testPathPatterns=users
# ^ 4 failures: UsersService's constructor gained a third dependency
#   (FollowsService) and toPublicProfileResponse's signature changed — the
#   existing spec's createDeps()/assertions predated both. Updated the mock
#   and rewrote the "isFollowedByMe" test to assert the real computed value
#   instead of a hardcoded false. 76/76 afterward.
pnpm exec nx run api:lint   # clean
pnpm exec nx run api:build  # webpack compiled successfully

pnpm exec nx run api-client:generate-types
# ^ confirms apps/api's module graph boots cleanly for OpenAPI introspection
#   with FollowsController registered; all 3 new route shapes
#   (/follow PUT+DELETE, /followers, /following) appeared in the generated
#   openapi-types.ts on the first run.
pnpm exec nx run api-client:test   # 40/40 (6 new follows-client.spec.ts cases)
pnpm exec nx run api-client:lint   # clean
pnpm exec nx run validation:test --skip-nx-cache   # 62/62 (6 new follow.spec.ts cases)

pnpm exec nx run web:build
# ^ Next build compiled + typechecked cleanly; new /[username]/followers and
#   /[username]/following routes both registered as dynamic (ƒ).
pnpm exec nx run web:lint
# ^ one warning: an unnecessary eslint-disable comment for
#   @next/next/no-img-element (that rule isn't actually configured in this
#   project — same pre-existing, harmless condition Milestone 9's
#   avatar-uploader.tsx already has). Removed the comment from my own new
#   file; left the pre-existing one alone (out of this milestone's scope).

pnpm exec tsc --noEmit -p apps/mobile/tsconfig.app.json   # clean
pnpm exec nx run mobile:lint    # clean
pnpm exec nx run mobile:test --testPathPatterns=profile-view
# ^ 10/10 on the first run once the test file's apiClient/expo-router mocks
#   were extended with follows.follow/unfollow and router.push.
pnpm exec nx run mobile:test --testPathPatterns=follow-lists   # 6/6, first run
pnpm exec nx run mobile:test   # 43/43, whole project
pnpm exec nx run mobile:build  # web/iOS/Android Hermes bundles all succeeded

pnpm exec nx run-many -t lint test build   # 28/28 tasks, whole workspace

pnpm exec nx run api:serve --configuration=development   # backgrounded
pnpm exec nx run api-e2e:e2e --testPathPatterns=follows
# ^ 11/11 passing on the first real run against the live Dockerized Postgres.
pnpm exec nx run api-e2e:e2e   # 9/9 suites, 38/38 tests, whole api-e2e run

pnpm exec nx run web-e2e:e2e --grep=follows -- --project=chromium
# ^ first attempt: nx swallowed --grep when combined with a trailing
#   `-- --project=chromium`, so all spec files ran (not just follows.spec.ts)
#   and their combined /auth/register calls blew through the 20/min throttle
#   — 7 failures, all registration timeouts, none in follows.spec.ts's own
#   logic. Re-ran with just `--grep=follows` (no trailing args, matching the
#   pattern that already worked for Milestone 9's avatar grep run): 3/3
#   passing on Chromium.
pnpm exec nx run web-e2e:e2e -- --project=chromium   # the whole suite together
# ^ first run: 14/15 passed, one follows.spec.ts test failed the same way —
#   this file alone registered 6 fresh accounts across its 3 tests, and
#   running right after the previous grep-filtered invocation (which itself
#   registered 6) left the combined count too close to the 20/min budget
#   within the same window. Reduced the file's own registration need from 6
#   to 4 (one shared `viewer` account registered once via `beforeAll` and
#   re-logged-in per test — login has its own, separate, unshared throttle —
#   `target`/`otherFollower` still registered fresh per test since their
#   assertions depend on starting at zero followers). 15/15 passing
#   afterward, confirmed on a clean run.

pnpm exec prettier --write "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}"
pnpm exec nx run-many -t lint test build   # re-verified 28/28 clean afterward
```

Both background `api:serve` instances confirmed stopped afterward — no stray processes
left listening on 3000.

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

### Milestone 8

- **`postsCount`/`followersCount`/`followingCount`/`avatarUrl` are hardcoded stubs
  (`0`/`0`/`0`/`null`), not omitted from the response.** `docs/API.md` §4 already
  specified these fields as part of `GET /users/:username`'s contract before this
  milestone existed to implement it — `Post`/`Follow`/`Media` don't exist yet
  (Milestones 9–11), so there's nothing real to compute. Shipping the honest-zero
  values now, with the final response _shape_ already correct, avoids a breaking
  API-contract change later when those tables land; the alternative (omitting the
  fields until they're meaningful) would mean `apps/web`/`apps/mobile` need a second
  round of changes just to add fields that were always going to exist. Each stub is
  commented in place (`toPublicProfileResponse`) pointing at the milestone that
  replaces it.
- **`isFollowedByMe` is `null` for an anonymous viewer, `false` (not `null`) for an
  authenticated one.** `docs/API.md` §4's original wording — "only computed when
  authenticated" — was ambiguous about _how_ an unauthenticated response should
  represent "not applicable" vs. "computed to be false." Resolved as: `null` means
  "there was no viewer to compute this for," `false` means "computed, and it's
  false" — semantically distinct, and a pattern later `*ByMe` fields (e.g. posts'
  `isLikedByMe`) can follow rather than each re-deciding this ambiguity.
- **No Follow/Unfollow button on the profile view, on either platform.**
  `docs/FEATURES.md` #3 describes one ("viewing another user's profile shows a
  Follow/Unfollow button"), but `Follow` doesn't exist until Milestone 10 — a button
  with no endpoint behind it would be dead UI. `docs/FEATURES.md` itself wasn't
  edited: it correctly describes the _complete_ feature, and Milestone 10 is where
  the rest of it lands: this is a milestone-sequencing gap, not a wrong spec.
- **`PATCH /me` is tested for "never touches another user's row," not "403 for a
  non-owner update."** `docs/IMPLEMENTATION_PLAN.md` M8's test scope literally asks
  for the latter, but `PATCH /me` has no `:username`/target parameter for a
  non-owner to even attempt targeting someone else with — the caller is always
  `req.user.id`, structurally. Redesigning the endpoint to take a target id just to
  manufacture a 403 case would be strictly worse API design (a parameter whose only
  valid value is "must equal the caller" adds an authorization check with nothing
  real to check). Implemented the equivalent, meaningful property instead: one
  user's update is proven to never affect another's row.
- **`toUserResponse` moved from `apps/api/src/modules/auth/` to
  `apps/api/src/common/mappers/`.** It's needed by `PATCH /me`'s response now, not
  just auth's own endpoints — `common/` already holds the other cross-module
  infrastructure (`HttpProblemException`, `HttpExceptionFilter`), so this is
  consistent with the existing convention, not a new one.
- **`AuthModule` now exports `JwtModule` itself, not just the guard classes.** See
  the `OptionalAuthGuard` bug entry below — this is both a deviation from the
  Milestone 5 comment claiming guard-class exports alone were sufficient, and the
  fix for the bug that comment's assumption caused.

None of Milestone 8's changes touch `docs/DATABASE.md` — no schema changes; `User`
already had every column this milestone reads or writes.

### Milestone 9

- **`User.avatarMediaId` is `@unique`, not just a plain nullable FK.** The original
  `docs/DATABASE.md` §3.1 column spec didn't call this out explicitly, but Prisma's
  schema DSL requires a unique field on the defining side to express a true
  one-to-one relation at all (`@relation` otherwise infers one-to-many). Recorded as
  a genuine invariant, not an arbitrary workaround: a given `Media` row can be at
  most one user's avatar. See `docs/DATABASE.md` §3.1's updated deviation note.
- **`PATCH /me/avatar` returns the `Media` resource (`MediaResponse`), not
  `UserResponse`.** `docs/API.md` §3 explicitly documents `UserResponseSchema` as
  _never_ including `avatarUrl` — a deliberate, pre-existing contract this milestone
  shouldn't widen. Since the client needs the resolved thumbnail URL immediately
  after setting an avatar (to update its UI without a second round trip), returning
  the media itself — with variant URLs already resolved — was the design that didn't
  require touching that documented exclusion.
- **No client-side crop widget on web; mobile gets a real one.** `docs/FEATURES.md`
  #4 originally said "square crop performed client-side... both web and mobile."
  Mobile delivers this via `expo-image-picker`'s free native cropper
  (`allowsEditing`/`aspect: [1,1]`). Web has no comparable zero-dependency crop UI —
  building a custom canvas-based cropper was judged out of scope for what this
  milestone's test bullets actually require (`docs/IMPLEMENTATION_PLAN.md` M9 never
  mentions a custom crop widget). Instead, the server's `sharp` center-crop
  (`fit: 'cover'`, applied to every `thumbnail` variant regardless of platform) is
  the single source of truth for "the avatar is square" — mobile's client crop is a
  UX nicety on top of that guarantee, not a substitute for it. `docs/FEATURES.md` #4
  updated to describe this as-implemented rather than the original aspirational
  wording.
- **`@nestjs/bullmq` pinned to `12.0.0`, the actual latest — no downgrade needed.**
  Every prior milestone that adopted an official `@nestjs/*` wrapper
  (`@nestjs/swagger`, `@nestjs/jwt`) had to pin to an older `11.x` line because their
  `12.x` majors require `@nestjs/core ^12.0.0`, which this repo doesn't run.
  `@nestjs/bullmq@12.0.0` is the exception: its peer range already includes
  `@nestjs/core "^10.0.0 || ^11.0.0 || ^12.0.0"`, so the "must avoid the latest
  major" reasoning from those earlier milestones doesn't apply here — worth noting
  so a future milestone doesn't reflexively downgrade this one out of habit.
- **`thumbnail` is always a square center-crop, for every `purpose` (`AVATAR` and
  `POST_IMAGE` alike), not just avatars.** `docs/ARCHITECTURE.md` §8's original
  wording only discussed variant sizes, not cropping behavior. Applying `fit:
'cover'` uniformly (rather than branching on `purpose` inside
  `generateMediaVariants`) is simpler, matches how Instagram's own grid thumbnails
  work for post images too, and is what makes the web avatar-upload path safe
  without a crop widget (see above). `feed` keeps the original aspect ratio
  regardless of `purpose`.
- **`/auth/register`'s throttle raised from 10 to 20 req/min/IP.** Revisits, rather
  than repeats, Milestone 8's bug #20 judgment ("not fixed by loosening the
  throttle... weakening it for test convenience wasn't judged worth the trade-off").
  That call held as long as reducing each file's own registration count could keep
  the whole suite under 10 — but Milestone 8 had already tuned the existing suite to
  consume _exactly_ 10, leaving zero headroom for `media-pipeline.spec.ts`'s own
  bare-minimum 2 registrations (an owner and an intruder, sharing both via
  `beforeAll`, same technique as before). With reduction exhausted, the remaining
  lever was the limit itself. 20/min/IP is still meaningfully stricter than the
  workspace default (100/min/IP) and the deliberate anti-credential-stuffing intent
  is preserved; it's sized with headroom for further test-suite growth so this
  doesn't need re-tuning again next milestone. See `docs/API.md` §1's updated note.

None of Milestone 9's deviations touch `docs/ARCHITECTURE.md` §8's core design
(presign → direct upload → complete → BullMQ → `READY`/`FAILED`) — only the
already-anticipated open questions within it (BullMQ package choice, crop
responsibility, thumbnail cropping behavior) are resolved for real now; see
`docs/ARCHITECTURE.md` §8's own "As implemented" addendum for the consolidated
record.

### Milestone 10

- **`followerId <> followingId` is a hand-added `CHECK` constraint, not a
  `@@check` in `schema.prisma`.** Prisma's schema DSL has no portable check-
  constraint attribute (confirmed against current docs before assuming this —
  see `docs/ARCHITECTURE.md` risk #9's "frameworks move fast" caution). Added
  by hand to the migration SQL, same technique already established for
  Milestone 9's media migration (different underlying gap: that one was a
  non-interactive-environment CLI guard, this one is a genuine DSL
  limitation). `FollowsService` also rejects self-follows at the application
  layer for a clean `409` — the DB constraint is a backstop, not the primary
  enforcement path, so a bug in the service layer can't silently corrupt data.
- **The inline follow/unfollow button on a followers/following list renders
  for any authenticated viewer, not gated to "only when it's your own
  list."** `docs/FEATURES.md` #6's original wording ("when viewing your own
  follower/following list") reads as a scope restriction, but
  `isFollowedByMe` is already computed per row regardless of whose list is
  being viewed — restricting the button to the viewer's own list would mean
  deliberately not using data the API already returns, for no clear benefit.
  Implemented as the more useful superset instead: any list, any
  authenticated viewer. `docs/FEATURES.md` updated to describe this
  as-implemented.
- **`isFollowedByMe` on a list row is a self-check when the row happens to be
  the viewer's own entry, and is therefore always `false` there** — e.g.
  viewing your own followers list, your own name (if you somehow followed
  yourself, which is impossible) would show "Follow," never "Unfollow." This
  isn't a special case in the implementation; it falls out naturally from
  "does the viewer follow this row's user," which is definitionally false for
  a self-row. Not fixed with special-case logic — the literal, uniform
  computation is more predictable than carving out an exception for one row.
  Recorded here because it's a real, slightly-surprising-at-first-glance
  behavior worth knowing about, not because it needs changing (also see Known
  Issues below, and `docs/API.md` §5's note on the same point).
- **Mobile's followers/following screens are flat routes
  (`app/profile/followers.tsx`/`following.tsx`) reached via `router.push`
  with `username` as a param, not nested under `app/profile/[username]/`.**
  Converting the existing flat `profile/[username].tsx` file into a
  `[username]/index.tsx` + `[username]/followers.tsx` directory structure
  just for these two new screens was judged more churn than benefit for two
  screens — Expo Router supports passing params to a flat route exactly as
  well as reading them from a nested dynamic segment. Web's equivalent
  (`apps/web`) uses genuinely nested `[username]/followers/page.tsx` instead,
  since Next.js App Router has no equivalent friction — a directory
  containing both `page.tsx` and a `followers/` subdirectory is its normal
  idiom, not a restructure.
- **`buildQueryString` extracted from `users-client.ts` into its own file**
  (`packages/api-client/src/lib/build-query-string.ts`), reused by the new
  `follows-client.ts`. The first genuinely shared piece of client transport
  logic beyond `HttpClient` itself — this codebase's established threshold
  ("duplicate until a second real consumer exists," applied consistently
  since Milestone 5) was crossed by this milestone's `getFollowers`/
  `getFollowing` needing the identical `?cursor=&limit=` serialization
  `getPosts` already had.
- **`/auth/register`'s `apps/web-e2e` register-call discipline tightened
  further**: `follows.spec.ts` registers one shared `viewer` account once via
  `beforeAll` and re-logs-in (a separate, much less constrained throttle) for
  each test, rather than a fresh register per test. This is the web-e2e
  equivalent of the `beforeAll`-shared-user technique `apps/api-e2e` adopted
  in Milestone 8 (bug #20) and is the first time that discipline has been
  applied on the Playwright side — worth reusing for every future
  `apps/web-e2e` file that needs a persistent, reusable identity across
  multiple tests within one file.

None of Milestone 10's deviations touch `docs/ARCHITECTURE.md`'s core design; `Follow`
matches `docs/DATABASE.md` §3.6 exactly (implementation-detail-level notes only — the
mapped table name and the `CHECK` constraint's mechanism), and the cursor pagination
implementation matches `docs/API.md` §1's design (opaque base64 `(createdAt, id)`
pair) precisely, being its first real instance.

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

### Milestone 8

19. **Exporting `JwtAuthGuard`/`OptionalAuthGuard` from `AuthModule` wasn't enough
    for `UsersModule` to use them.** `nx run api:serve` crashed on startup:
    `UnknownDependenciesException: Nest can't resolve dependencies of the
OptionalAuthGuard (?, PrismaService)... JwtService... is available in the
UsersModule module`. `PrismaService` resolved fine (`PrismaModule` is
    `@Global()`); `JwtService` didn't, because Nest constructs a guard referenced via
    `@UseGuards(SomeClass)` fresh, scoped to the _consuming_ module's injector — not
    by reusing the already-built singleton from wherever it was originally
    `provider`-registered. Milestone 5's own comment ("exported so those modules
    don't need to re-import JwtModule") assumed the opposite and was never actually
    exercised cross-module until this milestone. Fixed by also exporting the
    already-configured `JwtModule` instance from `AuthModule` (`docs/ARCHITECTURE.md`
    §7 now documents this explicitly). Caught by the manual curl walkthrough against
    the real server, not by any unit test — the guards' own unit tests construct them
    directly (`new OptionalAuthGuard(jwt, prisma)`), which never exercises Nest's
    module-resolution graph at all. Worth remembering: **a guard/interceptor/pipe
    class being `exports`-ed from its module is not sufficient proof it works from a
    different module** — only actually booting the app (or an integration test that
    does) proves that.
20. **`apps/api-e2e`'s registration budget is a shared, whole-suite resource, not a
    per-file one.** Adding `users/profile.spec.ts` (originally 10 fresh
    `POST /auth/register` calls, one per test) pushed the _combined_ total across
    all `api-e2e` spec files over the 10-req/min-per-IP throttle on `/auth/register`
    (`docs/API.md` §1) — Jest runs test files in parallel by default, so multiple
    files' registration bursts land in the same 60-second window regardless of file
    boundaries. Not fixed by loosening the throttle (a real, deliberate
    anti-credential-stuffing control from Milestone 5 — weakening it for test
    convenience wasn't judged worth the trade-off) or by serializing Jest workers
    (the whole suite finishes in ~1.5s regardless, well within one throttle window
    either way) — fixed by sharing 3 registered users across the whole file via
    `beforeAll` instead of registering fresh per test. Worth remembering for every
    future milestone that adds `api-e2e` tests needing a fresh account: **register
    the minimum number of users a file's tests actually need to stay independent,
    not one per `it()` by default** — this budget only gets tighter as more test
    files accumulate over the project's remaining milestones.
21. **A mocked `Link` component returning bare text broke `getByText` in
    React Native Testing Library**, even though the text was visibly present in the
    rendered debug tree. `Link: ({children}) => children` returns a raw string as
    `View`'s child, bypassing `<Text>` — `getByText` specifically queries `Text`
    host-component nodes, not arbitrary text anywhere in the tree, and RN's real
    renderer would have rejected this at runtime anyway ("Text strings must be
    rendered within a `<Text>` component"). Fixed by wrapping the mock's return in
    `<Text>` (sourced via `jest.requireActual('react-native')` inside the mock
    factory, since `jest.mock()` factories are hoisted above top-of-file imports and
    can't close over them).

### Milestone 9

22. **`prisma migrate dev` (and `--create-only`, and piping `echo "y" |` into it)
    all hit the same "environment is non-interactive" guard** the moment the new
    `avatarMediaId` unique-constraint change would normally trigger a cautionary
    interactive confirmation — identical in kind to a Prisma AI-agent safety guard
    hit in an earlier milestone, just a different trigger. Fixed with the same class
    of workaround: `prisma migrate diff --from-config-datasource
--to-schema=prisma/schema.prisma --script` generates the raw SQL non-interactively,
    then the migration folder is hand-placed (matching Prisma's own
    `<timestamp>_000N_name` convention) and applied via `prisma migrate deploy`,
    which is designed for non-interactive use and never hits this guard. Verified
    byte-for-byte against the live schema afterward (`psql \d media`, `\d users`),
    not just trusted because the command exited 0.
23. **`pnpm add`'s supply-chain `allowBuilds` gate blocked `msgpackr-extract`'s
    native build script** (a transitive dependency of `bullmq`/`ioredis`'s
    serialization layer) the first time the six new media-pipeline packages were
    installed, auto-inserting a placeholder line into `pnpm-workspace.yaml`. Same
    category as `sharp`/`argon2`'s existing entries (a real native module needed for
    functionality, not a telemetry beacon like the already-denied `@scarf/scarf`) —
    set to `true` with an explanatory comment.
24. **`@nestjs/bullmq` (and its `@nestjs/bull-shared` dependency) ship ESM-only —
    Jest's default `transformIgnorePatterns` broke `apps/api:test` outright**
    ("Unexpected token 'export'"), since Jest skips transforming anything under
    `node_modules` by default and these two packages have no CJS build. Fixing this
    for a pnpm-managed monorepo needed more than the usual single-segment
    allowlist regex: pnpm's real resolved path nests _two_ separate `node_modules`
    segments (`node_modules/.pnpm/@nestjs+bullmq@.../node_modules/@nestjs/bullmq`),
    and an anchored lookahead only clears whichever one it's anchored to. Fixed with
    an unbounded `.*` lookahead in `apps/api/jest.config.cts`'s
    `transformIgnorePatterns` that scans the rest of the path for either package
    name, which clears both segments regardless of nesting depth — worth reusing
    verbatim for any future ESM-only dependency under pnpm, not just these two.
25. **`apps/api-e2e`'s shared `/auth/register` throttle budget (Milestone 8, bug
    #20) had zero headroom left**, not just "tight" — the existing suite already
    consumed exactly its 10/min/IP limit before this milestone's tests existed, so
    even the bare-minimum 2 new registrations (reusing Milestone 8's
    share-via-`beforeAll` technique) still 429'd 4 of the new file's 6 tests when
    run alongside the rest of the suite. This is the first milestone where reducing
    a new file's own registration count wasn't sufficient by itself — see the
    Deviations entry above for the throttle-limit change this forced, and why it's
    a considered revisit of bug #20's judgment rather than an inconsistency with it.
26. **A pre-existing, unrelated type error surfaced on `apps/mobile`'s first-ever
    standalone `tsc --noEmit` pass**: `apps/mobile/src/app/profile/[username].tsx`
    imported `PublicProfileResponse` from `@instagram-clone/api-client`, which never
    exported it — it's defined in `@instagram-clone/validation`. This predates
    Milestone 9 entirely (introduced in Milestone 8, per `git log` on the file) and
    had gone unnoticed because nothing in this repo's validation pipeline runs a
    plain `tsc --noEmit` against `apps/mobile` directly (Jest/Metro's own type
    handling is more permissive). Fixed the import; not otherwise in this
    milestone's scope, but leaving a known-broken import in place contradicts
    CLAUDE.md's "fix known issues" standing instruction once discovered.

### Milestone 10

27. **`noUncheckedIndexedAccess` rejected `page[page.length - 1]` in
    `FollowsService.toListResponse`** (`Object is possibly 'undefined'`) —
    TypeScript strict mode has no way to know that `page.length - 1` is a
    valid index just because `page` came from a non-empty-checked slice.
    Fixed with `page.at(-1)` plus an explicit truthiness check on the result,
    which both satisfies the type checker and is more idiomatic than a
    non-null assertion.
28. **`UsersService`'s unit tests broke the moment `FollowsService` became its
    third constructor dependency** — `users.service.spec.ts`'s `createDeps()`
    predated this milestone and only mocked `prisma`/`mediaService`,
    so `new UsersService(prisma, mediaService)` (missing the third arg)
    left `this.followsService` `undefined`, throwing on the first call inside
    `getPublicProfile`. Not a design flaw — exactly the kind of break a
    constructor-signature change is supposed to surface immediately via a
    failing test suite. Fixed by extending `createDeps()` and rewriting the
    `isFollowedByMe` test to assert the real value `FollowsService.isFollowing`
    returns instead of the old hardcoded-`false` expectation that predated
    `Follow` existing.
29. **Combining `--grep` and a trailing `-- --project=chromium` on the same
    `nx run web-e2e:e2e` invocation silently dropped the `--grep` filter**,
    running every spec file instead of just the targeted one — not a bug in
    this milestone's code, but worth recording since it cost real debugging
    time chasing what looked like a flaky follows-list test before the actual
    cause (the whole suite's combined `/auth/register` calls exceeding the
    throttle) became clear. `--grep=X` alone (no trailing `--` args) filters
    correctly, as does `-- --project=chromium` alone; the two together do not
    combine as expected in this Nx/Playwright wiring. Prefer running one or
    the other, not both, until this is worth investigating further.

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
- **`apps/api-e2e`'s `/auth/register` throttle budget (10/min/IP) is shared across
  the whole suite, not per file** (Milestone 8, bug #20 above) — every future
  milestone that adds `api-e2e` tests needing fresh accounts should register the
  minimum it actually needs (shared fixtures via `beforeAll`, not one per test) or
  this will resurface, worse, as more test files accumulate. Not fixed at the
  throttle-configuration level on purpose — see the Milestone 8 deviations entry for
  why loosening it wasn't judged worth the trade-off.
- **`profile.postsCount` is still a hardcoded stub** (`0`) until `Post` exists
  (Milestone 11) — `avatarUrl` (Milestone 9) and `followersCount`/`followingCount`/
  `isFollowedByMe` (Milestone 10) are all real now. The response _shape_ is already
  final (`docs/API.md` §4, the Milestone 8 deviation above) — only the value inside
  `toPublicProfileResponse` (`apps/api/src/modules/users/`) needs to change when
  `Post` lands, not the schema or any client code.
- **The public profile _view_ screens (web's `[username]/page.tsx`, mobile's
  `profile/[username].tsx`) don't render the avatar image at all** — only the
  Milestone 8/9 profile-_edit_ screens show it (that was this milestone's explicit
  scope: wiring avatar upload into the edit screens). `PublicProfileResponse.avatarUrl`
  is already populated and ready to use; adding an `<img>`/`<Image>` to the view
  screens is a small, low-risk follow-up whenever profile viewing itself gets its
  next pass, not a gap in the media pipeline itself.
- **`Media.blurhash` is generated and stored but not consumed by any client UI yet**
  — there's no progressive-image-loading surface to use it until posts/feed
  rendering exists (Milestone 11/12). The field and its generation are real and
  tested; only the consuming UI is future work.
- **Web E2E's avatar upload test was only run against Chromium**, same
  environment limitation already noted for Milestone 8's web-e2e coverage
  (Firefox/WebKit browsers not installed here) — not new to this milestone.
- **`apps/api-e2e`'s `/auth/register` throttle is now 20/min/IP, not 10** (Milestone
  9's deviation above) — still a shared, whole-suite budget, just with more
  headroom. The same discipline from Milestone 8's bug #20 still applies: register
  the minimum a file's tests actually need via shared `beforeAll` fixtures, not one
  per test.
- **`isFollowedByMe` on a followers/following list row is always `false` when the
  row happens to be the viewer's own entry** (Milestone 10, see Deviations above) —
  a correct, literal consequence of "does the viewer follow this row's user," not a
  bug, but worth knowing before assuming a "Follow" button next to your own name in
  your own follower list means something is broken.
- **No follower-count/following-count caching or denormalization** —
  `FollowsService.getFollowCounts` runs two real `COUNT(*)` queries against
  `follows` on every `GET /users/:username` call. Fine at MVP scale (`follows` has
  two small, well-indexed columns per row); revisit with a denormalized counter
  column (updated transactionally on follow/unfollow) only if profile-view query
  latency actually becomes a problem under real load — not a speculative concern to
  address now.
- **Web E2E's follow/unfollow tests were only run against Chromium** — same
  pre-existing Firefox/WebKit-not-installed environment limitation noted for
  Milestone 8/9's web-e2e coverage, not new to this milestone.
- **`apps/web-e2e` now has its own version of the shared-account discipline**
  (Milestone 10's Deviations entry above: `follows.spec.ts` registers one `viewer`
  once and re-logs-in per test) — worth applying the same pattern to any future
  `apps/web-e2e` file whose tests need a persistent, reusable identity, the way
  `apps/api-e2e` already does via `beforeAll`-shared users.

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
export target) are equally settled, not open questions. Milestone 8's six deviations
(hardcoded stub counts/avatar instead of omitting the fields, `isFollowedByMe`'s
`null`-vs-`false` split, no Follow button yet, the `PATCH /me` non-owner test
reinterpretation, moving `toUserResponse` to `common/`, and exporting `JwtModule`
from `AuthModule`) are likewise each decided and recorded above with rationale, not
left open. Milestone 9's six deviations (`avatarMediaId`'s `@unique`, `PATCH
/me/avatar` returning `MediaResponse` instead of widening `UserResponse`, web's
server-side-crop-only vs. mobile's real client crop, `@nestjs/bullmq@12.0.0` needing
no downgrade, uniform square-cropping of every `thumbnail` regardless of `purpose`,
and the register-throttle increase) are equally each decided and recorded above with
rationale, not left open. Milestone 10's six deviations (the hand-added `CHECK`
constraint, the inline follow button rendering for any viewer rather than only on the
viewer's own list, the self-row `isFollowedByMe` computation, mobile's flat
followers/following routes vs. web's nested ones, extracting `buildQueryString`, and
web-e2e's shared-`viewer`-via-login discipline) are equally each decided and recorded
above with rationale, not left open. Everything else recorded in this file is
implementation-detail-level — versions, ports, a webpack externals list, one deferred
column, one simplified index, two deferred extensions — with rationale in
`docs/DATABASE.md` and `docs/ARCHITECTURE.md` where it touches those docs. None of it
changes anything either document asserts at the design level.

---

## Next Milestone

**Milestone 11 — Posts (Create, Read, Delete)**: per `docs/IMPLEMENTATION_PLAN.md`,
`apps/api`'s fourth domain module and the first to actually consume Milestone 9's
media pipeline for something other than avatars — the first milestone where
`Media.purpose: POST_IMAGE` rows get attached to anything. Also the first milestone
rendering uploaded media through `next/image` (risk #9 in `docs/ARCHITECTURE.md` —
confirm current Next 16 image-handling APIs before assuming this document's wording is
still accurate).

1. Schema: `Post` and `PostMedia` (`docs/DATABASE.md` §3.4/§3.5) — a new migration.
   `PostMedia` orders a post's images (array order matters, docs/API.md §7); confirm
   the ordering-column design against `docs/DATABASE.md` §3.5 rather than assume a
   plain integer `position` column is what's specified.
2. API (`docs/API.md` §7): `POST /posts` (body `{ caption?, location?, mediaIds:
string[] }`, 1–10 items — every `mediaId` must be the caller's own `READY`,
   `POST_IMAGE`-purpose media, not already attached to another post; reuse the
   ownership/status-check pattern `MediaService.setAsAvatar` already established for
   avatars, docs/ARCHITECTURE.md §8 point 4), `GET /posts/:id` (optional auth —
   author, ordered media, counts, `isLikedByMe`/`isSavedByMe` — both `false`/`null`
   stubs until Milestones 13/15 land `Like`/`SavedPost`, same stub-now-fill-later
   pattern `PublicProfileResponse` used from Milestone 8 through this one),
   `DELETE /posts/:id` (author-only soft delete, `403` for a non-author attempt —
   this is the first endpoint that actually needs that check, unlike `PATCH /me`'s
   Milestone 8 workaround).
3. Web + mobile: a create-post flow reusing Milestone 9's presign→upload→poll flow
   for multiple images (`MediaClient.waitUntilProcessed`/`uploadToPresignedUrl`
   already handle one image at a time — decide explicitly whether to parallelize
   multi-image uploads or await them sequentially, and document the choice rather
   than default silently), caption/location inputs, a post detail view, and the
   profile grid actually showing real posts (`GET /users/:username/posts`, stubbed
   empty since Milestone 8, `docs/PROGRESS.md`'s Milestone 8 entry).
4. **Tests**: integration tests for multi-image post creation, including the
   media-must-be-`READY`-and-owned-by-caller validation and the 1–10 image bound
   (both boundaries: 0 images and 11 images should both fail) — against the real
   MinIO/Redis pipeline, not mocked, matching Milestone 9's own testing discipline;
   Playwright covers creating a post with 2+ images and seeing it on the profile
   grid.

Before starting it: re-read `docs/IMPLEMENTATION_PLAN.md`'s Milestone 11 section,
`docs/DATABASE.md` §3.4/§3.5 (`Post`/`PostMedia`) in full, and `docs/API.md` §7. Note
the register-throttle/shared-account disciplines from Milestones 8–10 (`apps/api-e2e`:
share users via `beforeAll`, budget is 20/min/IP; `apps/web-e2e`: register once,
re-login per test where a persistent identity is needed) — apply them from the start
for this milestone's test files rather than registering fresh per test and hitting the
same wall. Also worth deciding explicitly before writing the create-post endpoint:
whether `mediaIds` ownership/status validation happens as N sequential `MediaService`
calls or one batched query — `MediaService` doesn't currently expose a
`getOwnedMedia`-for-multiple-ids method, so this is a real design choice, not a
detail to default without recording.
