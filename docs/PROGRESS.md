# Project Progress

This file tracks the current implementation status of the Instagram clone.

It should be updated after every completed milestone or meaningful development session.

---

## Current Status

**Phase:** Infrastructure
**Current Milestone:** Milestone 0 — Project Scaffolding
**Status:** Complete

The Nx/pnpm monorepo, all three application shells (web, api, mobile), the five
shared packages, the Prisma toolchain, and local Docker infrastructure are all
scaffolded, wired together, and passing lint/test/build validation. No product
features have been implemented — every app still shows framework-default or
placeholder content, exactly as scoped.

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

---

## Validation Performed

All commands below were run against this milestone's final state and passed:

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

**Note for whoever continues this work**: the above were run interactively; there is
no CI pipeline yet. Wiring `nx affected -t lint test build e2e` into CI is explicitly
scoped to Milestone 20 (hardening pass) in `docs/IMPLEMENTATION_PLAN.md`, not before.

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

---

## Architectural Decisions Pending

None. The deviations above are implementation-detail-level (versions, ports, a
webpack externals list) — they don't change anything `docs/ARCHITECTURE.md`,
`docs/DATABASE.md`, `docs/API.md`, or `docs/FEATURES.md` asserts at the design level.

---

## Next Milestone

**Milestone 1 — Local Infrastructure (Docker Compose)** is effectively already done
as a side effect of this milestone (see above) — `docker-compose.yml` exists and all
four services run healthy. The next real milestone is **Milestone 2 — Prisma Base
Schema**: add the `User` and `RefreshToken` models (`docs/DATABASE.md` §3.1–3.2),
the `citext`/`pgcrypto`/`pg_trgm` extensions, and the first real migration.

Before starting it: re-read `docs/IMPLEMENTATION_PLAN.md`'s Milestone 2 section and
`docs/DATABASE.md` in full, and confirm the exact Prisma 7 UUID-generation approach
(§1's open question) against Prisma's current docs before writing the schema.
