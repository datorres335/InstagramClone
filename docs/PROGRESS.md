# Project Progress

This file tracks the current implementation status of the Instagram clone.

It should be updated after every completed milestone or meaningful development session.

---

## Current Status

**Phase:** Infrastructure
**Current Milestone:** Milestone 3 — Shared Types & Validation (Base)
**Status:** Complete

The Nx/pnpm monorepo, all three application shells (web, api, mobile), the five
shared packages, the Prisma toolchain, and local Docker infrastructure are all
scaffolded and passing validation (Milestone 0, with Docker infra/Milestone 1 landing
as a side effect of it). The first real database models — `User` and `RefreshToken` —
are implemented, migrated, and seeded (Milestone 2). `packages/types` and
`packages/validation` now carry real, tested content for everything auth needs
(Milestone 3) — the single source of truth register/login/refresh/logout/session will
be validated against once Milestone 5 (Auth) implements the actual endpoints. No
product features (endpoints, UI) have been implemented — every app still shows
framework-default or placeholder content, exactly as scoped.

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

---

## Bugs Found and Fixed During Scaffolding

Worth recording since they'd otherwise resurface identically for the next person:

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
  integration tests only. Obvious and low-stakes today with only 3 seed users and no
  auth endpoints yet; worth a reminder once Milestone 5 (Auth) makes these accounts
  actually log-in-able, so nobody mistakes this for a real credential scheme.

---

## Architectural Decisions Pending

None. Milestone 3 resolved the two decisions `docs/IMPLEMENTATION_PLAN.md` and
`docs/FEATURES.md` had explicitly deferred to it (password policy, logout body shape —
see "Milestone 3 — Architectural Decisions Made" above). Everything else recorded in
this file (Milestone 0 and Milestone 2 alike) is implementation-detail-level —
versions, ports, a webpack externals list, one deferred column, one simplified index,
two deferred extensions — with rationale in `docs/DATABASE.md` and `docs/ARCHITECTURE.md`
where it touches those docs. None of it changes anything either document asserts at the
design level.

---

## Next Milestone

**Milestone 4 — API Bootstrap**: per `docs/IMPLEMENTATION_PLAN.md`, most of the
generic bootstrap work (Nest app generation, `ConfigModule`/`packages/config` wiring,
`helmet`, CORS, URI versioning, `apps/api-e2e`) already landed in Milestone 0 — what's
actually left is: a DI-provided `PrismaModule`/`PrismaService` wrapping the
`@prisma/client`+`@prisma/adapter-pg` setup from Milestone 2 (with `OnModuleInit`/
`OnModuleDestroy` connect/disconnect); a global `ZodValidationPipe` (via `nestjs-zod`)
that finally makes `apps/api` consume the schemas this milestone (M3) built, instead of
them sitting unused; a global exception filter producing the RFC 7807 Problem Details
shape `docs/API.md` §1 specifies; `@nestjs/swagger` wired to emit `openapi.json`
(needed by Milestone 6's `packages/api-client` codegen pipeline — see
`docs/ARCHITECTURE.md` risk #2); and an explicit `GET /api/v1/health` endpoint.

Before starting it: re-read `docs/IMPLEMENTATION_PLAN.md`'s Milestone 4 section and
`docs/ARCHITECTURE.md` §5.2 (API module structure). Confirm current `nestjs-zod` and
`@nestjs/swagger` versions/APIs against their docs before wiring them in — both are
exactly the kind of "framework moves fast" dependency `docs/ARCHITECTURE.md` risk #9
warns about, and neither has been installed yet in this repo.
