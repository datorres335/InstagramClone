# Architecture

Status: design phase — no application code has been written yet. This document is the
source of truth for how the system fits together; `DATABASE.md`, `API.md`, `FEATURES.md`
and `IMPLEMENTATION_PLAN.md` all assume the decisions recorded here.

## 1. Goals & Non-Goals

**Goals**

- A production-quality, horizontally-scalable Instagram-style application (photos, not
  video) built as a pnpm/Nx TypeScript monorepo.
- Maximum sharing of _logic_ (types, validation, API contracts) between web, mobile and
  API without forcing UI code to be shared.
- REST API that is boring, predictable, and independently versionable from its clients.
- A schema and API surface that can grow into the "future features" list (stories,
  reels, DMs, push, realtime) without a rewrite.

**Non-goals (for this phase)**

- No implementation yet — this pass is architecture + docs only.
- No video/Reels/Stories pipeline (listed as future work only).
- No real-time transport beyond Server-Sent Events (§5.4, implemented Milestone 22) —
  no bidirectional WebSocket channel, since nothing in this MVP's feature set has the
  client send anything over the realtime connection itself (every mutation already goes
  through the existing REST endpoints); SSE's one-directional push is the complete fit.
- No multi-region / multi-tenant design — single-region deployment is assumed.

## 2. Technology Summary

| Concern         | Choice                                                                | Notes                                                              |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Monorepo        | Nx (latest stable)                                                    | Task graph, caching, generators, module boundaries                 |
| Package manager | pnpm                                                                  | Workspaces via `pnpm-workspace.yaml`; single lockfile at repo root |
| Language        | TypeScript (strict mode everywhere)                                   | Shared `tsconfig.base.json`                                        |
| Web             | Next.js 16, App Router                                                | React 19, Turbopack, Server Components + `"use cache"`             |
| API             | NestJS (latest stable, v11.x line)                                    | Modular, DI-based, REST controllers                                |
| Mobile          | Expo (latest stable SDK), Expo Router                                 | File-based routing, New Architecture on                            |
| ORM             | Prisma 7                                                              | TypeScript query engine, driver adapters, `prisma.config.ts`       |
| Database        | PostgreSQL 17                                                         | `pg_trgm`, `citext`, `pgcrypto` extensions                         |
| Validation      | Zod 4                                                                 | Single source of truth in `packages/validation`                    |
| API style       | REST, URI-versioned (`/api/v1`)                                       | OpenAPI generated from the same Zod schemas                        |
| Auth            | Access JWT + rotating refresh tokens                                  | Refresh-token-family reuse detection                               |
| Object storage  | S3-compatible (MinIO locally, AWS S3/R2 in prod)                      | Client uploads via presigned URLs                                  |
| Background jobs | Redis + BullMQ                                                        | Image variants, notification fan-out                               |
| Local infra     | Docker Compose                                                        | Postgres, MinIO, Redis, Maildev                                    |
| Testing         | Vitest (unit), Nest/Supertest (API integration), Playwright (web E2E) | Per-project Nx targets                                             |
| Lint/format     | ESLint 9 (flat config) + Prettier                                     | Shared `packages/eslint-config`                                    |
| UI styling      | Web: Material UI v9 + Tailwind CSS v4; mobile: React Native Paper v5 + NativeWind v4 | **Planned, Milestones 23–26** — shared `packages/design-tokens`, see §5.5 |

Exact framework minor/patch versions are intentionally not pinned in this document —
confirm current stable versions against each framework's official docs at the moment a
milestone that installs them begins (see `IMPLEMENTATION_PLAN.md`, Milestone 0), since
this design phase and the first line of code may be separated in time.

## 3. Monorepo Structure

```
instagram-clone/
├── apps/
│   ├── web/                 # Next.js 16 (App Router) — apps/web/app/**
│   ├── api/                 # NestJS — apps/api/src/modules/**
│   ├── api-e2e/             # API integration tests (Nx convention: <app>-e2e)
│   ├── web-e2e/             # Playwright E2E for the web app
│   └── mobile/              # Expo Router app
│
├── packages/
│   ├── types/                # Shared TS types & enums (framework-agnostic)
│   ├── validation/            # Zod schemas — the single source of truth for shapes
│   ├── api-client/            # Typed REST client consumed by web + mobile
│   ├── config/                 # Env schema + typed config loader (zod-validated)
│   ├── design-tokens/          # (planned, Milestone 23) colors/type/spacing tokens for web + mobile themes
│   └── eslint-config/          # Shared flat ESLint config + Prettier config
│
├── prisma/
│   ├── schema.prisma
│   ├── prisma.config.ts
│   ├── migrations/
│   └── seed.ts
│
├── docker/                    # Compose file + service-specific config (e.g. MinIO init)
├── docs/
├── nx.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
└── CLAUDE.md
```

Notes:

- `prisma/` lives at the repo root, **not** inside `apps/api`, because the Prisma
  Client it generates is a _shared_ build artifact: the API imports it directly, and
  `packages/validation`/`packages/types` may derive types from it (e.g. via
  `Prisma.UserGetPayload<...>` helper types) without depending on the whole `api` app.
  It is wrapped in an Nx project (`prisma`) so `generate`/`migrate` are cacheable Nx
  targets with proper `dependsOn` wiring ahead of `api`'s build/test/serve targets.
- `api-e2e` and `web-e2e` are separate Nx projects (the standard Nx convention) rather
  than folders inside `api`/`web`, so their heavier dependencies (Supertest, Playwright)
  and slower CI targets don't pollute the app projects' dependency graphs.

### 3.1 Nx configuration

- Workspace created with `--packageManager=pnpm`; every install goes through `pnpm add`
  (never `npm`/`yarn`) — enforced by `pnpm-workspace.yaml` plus a root `.npmrc`
  (`engine-strict=true`) and documented in `CLAUDE.md`.
- Official Nx plugins used for generators + inferred tasks: `@nx/next`, `@nx/nest`,
  `@nx/expo`, `@nx/js` (for `packages/*`), `@nx/eslint`, `@nx/vite` (unit tests),
  `@nx/playwright`. Nx's inferred-tasks model reads each project's native config
  (`next.config.ts`, `nest-cli.json`, `app.config.ts`, `vite.config.ts`,
  `playwright.config.ts`) to derive `build`/`test`/`lint`/`serve` targets, so there is
  minimal custom `project.json` boilerplate.
- `nx.json` defines the task pipeline so that `build`/`test` depend on
  `^build` (dependencies built first) and on Prisma Client generation; named inputs
  exclude `docs/**` and `*.md` from cache-busting `production` builds.
- Remote/local caching: local Nx cache is on by default; if the team wants CI cache
  sharing, that's an explicit later decision (Nx Cloud or a self-hosted cache), not
  assumed here.

### 3.2 Module boundaries

Enforced with `@nx/enforce-module-boundaries` via project tags:

| Tag            | Applied to                                                     | Allowed dependencies        |
| -------------- | -------------------------------------------------------------- | --------------------------- |
| `scope:web`    | `web`, `web-e2e`                                               | `scope:shared`              |
| `scope:api`    | `api`, `api-e2e`, `prisma`                                     | `scope:shared`              |
| `scope:mobile` | `mobile`                                                       | `scope:shared`              |
| `scope:shared` | `types`, `validation`, `api-client`, `config`, `eslint-config`, `design-tokens` (planned M23) | `scope:shared` only         |
| `type:app`     | apps                                                           | `type:feature`, `type:util` |
| `type:util`    | `types`, `validation`, `config`, `eslint-config`, `design-tokens` (planned M23) | `type:util` only            |
| `type:feature` | `api-client`                                                   | `type:util`                 |

Rules encoded in root ESLint config:

1. `scope:web` and `scope:mobile` **must never** depend on `scope:api` (no importing
   Nest code into a client), and vice versa.
2. `packages/api-client` may depend on `types` and `validation`, but not on `api`
   itself (it talks to the API over HTTP only) and not on Prisma (no leaking DB types
   to clients).
3. `packages/types` and `packages/validation` have **zero** dependencies on any `apps/*`
   project — this is what makes them genuinely shared.
4. UI component libraries are deliberately **not** a shared package — see §6.

## 4. System Diagram

```
                     ┌─────────────────────┐        ┌─────────────────────┐
                     │   apps/web (Next)   │        │  apps/mobile (Expo)  │
                     │  Server + Client    │        │   React Native App   │
                     │    Components       │        │                      │
                     └──────────┬──────────┘        └──────────┬───────────┘
                                │  uses                          │  uses
                                ▼                                ▼
                       ┌───────────────────────────────────────────────┐
                       │           packages/api-client (typed)          │
                       │   fetch wrapper + access-token refresh logic   │
                       └───────────────────────┬───────────────────────┘
                                                │ HTTPS / JSON (REST)
                                                ▼
                                     ┌─────────────────────┐
                                     │   apps/api (Nest)    │
                                     │  Controllers → Services → Repositories │
                                     └───┬───────────┬──────┘
                              Prisma     │           │  presigned URL issuance
                                         ▼           ▼
                              ┌─────────────────┐   ┌────────────────────┐
                              │  PostgreSQL 17   │   │  S3-compatible      │
                              │  (primary store) │   │  object storage     │
                              └─────────────────┘   └─────────┬──────────┘
                                         ▲                     │ direct client upload
                                         │ enqueue/consume      │ (browser/app → bucket)
                                         ▼                     ▼
                              ┌─────────────────┐    ┌────────────────────┐
                              │ Redis + BullMQ   │    │  (media variant     │
                              │ (jobs, throttling)│──▶│  worker consumes    │
                              └─────────────────┘    │  from bucket)       │
                                                       └────────────────────┘
```

Both web and mobile talk to the API exclusively through `packages/api-client`; neither
talks to Postgres, Redis or the object store directly. Media bytes flow **client → S3
directly** (presigned URL), not through the API process, to avoid the API becoming a
large-file proxy.

## 5. Application Architecture

### 5.1 `apps/web` — Next.js 16, App Router

- App Router only (no `pages/`). Route groups: `(auth)` for login/register,
  `(app)` for the authenticated shell (feed, profile, explore, notifications, settings).
- Rendering strategy:
  - Public/shareable pages (a single post permalink, a public profile) use Server
    Components with the `"use cache"` directive (Cache Components model) plus
    `revalidateTag` invalidation triggered from the API-client mutation layer, so a new
    like/comment can bust the right cache entries.
  - The authenticated feed, notifications, and any per-user views are dynamic (no
    full-route caching) since they depend on the caller's session and follow graph.
  - Mutations (create post, follow, like) go through Server Actions that call
    `packages/api-client`, which in turn call the Nest API — the Next server acts as a
    thin, trusted caller of the API using the same REST contract mobile uses, so there
    is exactly one authorization surface (the API), not two.
- Auth on web (implemented Milestone 6 — see §7 for the full reasoning and the
  deviation from this section's original draft): the Next server keeps its **own**
  httpOnly/Secure/SameSite=Lax session cookie on `apps/web`'s own origin, never the
  API's — `apps/web` calls the API the same way `mobile` does (an explicit
  `refreshToken` in the request body), not via a shared cross-origin cookie, so there's
  no dependency on `apps/web` and `apps/api` sharing a browser-visible cookie domain.
  `proxy.ts` (Next 16's renamed `middleware.ts`) keeps that cookie's access token from
  going stale between requests, since `cookies()` can only be _written_ from a Server
  Action or Route Handler, never a plain page render.
- Images: plain `<img>` elements, not `next/image` (deviation from this section's
  original draft, confirmed empirically in Milestone 9 and reconfirmed against current
  Next 16 docs in Milestone 11 per risk #9 rather than assumed). The API already
  returns fully-qualified, fixed-dimension media URLs (`sharp`-generated variants —
  `thumbnail`/`feed` — not raw storage keys), so there is no on-demand resizing left
  for `next/image`'s optimizer to usefully do; its only remaining value would be lazy
  loading, which isn't worth `next/image`'s own overhead (a `remotePatterns` allowlist
  that has to track every MinIO/S3 host across environments, plus its Node-side proxy
  route for every image request) for images already served pre-sized straight from
  object storage. Both the avatar (Milestone 9) and post (Milestone 11) image
  pipelines use plain `<img>` consistently for this reason.

### 5.2 `apps/api` — NestJS

- Modular structure under `apps/api/src/modules/<domain>` (`auth`, `users`, `follows`,
  `posts`, `media`, `likes`, `comments`, `saved-posts`, `search`, `explore`,
  `notifications`), each with `*.controller.ts`, `*.service.ts`, `*.repository.ts` (thin
  Prisma-facing layer), and `*.module.ts`. Controllers stay HTTP-only concerns
  (status codes, DTO mapping); business rules live in services so they're unit-testable
  without an HTTP layer.
- Global concerns, each its own module under `apps/api/src/{config,prisma,health}`
  (siblings of `src/app`, not under `src/modules/<domain>` — they aren't domain
  features): `ConfigModule` (wraps `packages/config`, provides the validated env via
  an `API_ENV` DI token), `PrismaModule` (provides a single `PrismaClient` via DI,
  `onModuleInit`/`onModuleDestroy` connect/disconnect) — both implemented Milestone 4.
  `AuthModule` (custom JWT guard, `argon2id` hashing, refresh rotation with reuse
  detection — see §7) and `ThrottlerModule` (`@nestjs/throttler`, **in-memory**
  storage, not Redis — see the Milestone 5 deviation in `docs/PROGRESS.md`) are
  implemented as of Milestone 5. `UsersModule` (`GET /users/:username`,
  `GET /users/:username/posts`, `PATCH /me`) is implemented as of Milestone 8 — the
  first domain module besides `auth` to exist, and the first to import `AuthModule`
  for its guards rather than define its own (see §7's `OptionalAuthGuard` note).
  `MediaModule`/`StorageModule` (presign/upload/process pipeline, §8) landed Milestone 9. `FollowsModule` (`PUT`/`DELETE /users/:username/follow`,
  `GET /users/:username/followers`/`following`) landed Milestone 10 — `UsersModule`
  imports it (not the reverse) so `PublicProfileResponse`'s
  `followersCount`/`followingCount`/`isFollowedByMe` can resolve through
  `FollowsService`, the same dependency shape `MediaService`/`avatarUrl` already
  established. A global
  `HttpExceptionFilter` (`apps/api/src/common/filters`) producing RFC 7807 Problem
  Details, and a global `ZodValidationPipe` (via `nestjs-zod`, registered through
  `APP_PIPE`) so every DTO is validated against a schema imported from
  `packages/validation` — **not** re-declared with `class-validator` decorators, to
  keep one validation source of truth across API/web/mobile — are also implemented
  (Milestone 4).
- API versioning via Nest's built-in URI versioning (`/api/v1/...`); every controller is
  explicitly versioned from day one even though only `v1` exists, so a `v2` migration
  later is additive, not a breaking refactor.
- OpenAPI: `@nestjs/swagger` (pinned to the 11.x line — see the NestJS-11 deviation in
  `docs/PROGRESS.md`; its `12.x` requires NestJS 12) generates the document from the
  same Zod-derived DTOs, passed through `nestjs-zod`'s `cleanupOpenApiDoc` (the
  function nestjs-zod actually ships for this — not `zodToOpenAPI`, this document's
  original guess) before `SwaggerModule.setup`. Served at `/api/docs` (interactive UI)
  and `/api/docs-json` (raw document) in non-production; exported as a literal
  `openapi.json` build artifact for `packages/api-client` codegen (§6.3) is deferred to
  Milestone 6, once that package's actual consumption contract exists to design it
  against — implemented Milestone 4.
- Background jobs run **in-process** in `apps/api` for the MVP (a `BullMQ` `Processor`
  registered in the relevant module, e.g. `MediaModule` processes image-variant jobs) —
  see the risk register (§16) for when this should be split into a separate worker app.

### 5.3 `apps/mobile` — Expo + Expo Router

- File-based routing under `apps/mobile/src/app/`: `(auth)/login`, `(auth)/register`
  and `(tabs)/home` implemented Milestone 7 (a stub, same scope as `apps/web`'s
  `/home` — Milestone 6); `(tabs)/feed`, `(tabs)/explore`, `(tabs)/notifications`,
  `profile/[username]`, `post/[id]` land in later milestones as those features do,
  additively, since `(tabs)` is already a real `Tabs` layout, not a placeholder.
  Session state is plain React context (`lib/auth-context.tsx`), not Server
  Components/Actions — there's no on-device equivalent, so each screen calls
  `apiClient.auth.*` directly and updates context state itself.
- New Architecture (Fabric/TurboModules) enabled by default at the current Expo SDK;
  no reliance on legacy-architecture-only libraries.
- Auth on mobile (implemented Milestone 7): both access and refresh tokens stored
  together as one JSON value via `expo-secure-store` (iOS Keychain / Android
  Keystore) — never `AsyncStorage`, which is unencrypted. `api-client` is
  platform-agnostic and receives a small storage adapter injected per platform
  (cookie-based on web, SecureStore-based on mobile) so the refresh logic itself is
  shared code — confirmed by this milestone: `HttpClient`/`AuthClient` needed zero
  changes to support a structurally different adapter (see §7, risk #5). Built once
  at module load as `lib/api-client.ts`'s `apiClient` singleton, unlike `apps/web`
  (which must build a fresh client per request, since Next's `cookies()` is only
  valid within a request scope) — mobile has no such constraint.
  `expo-secure-store` has no web implementation (it's genuinely OS-Keychain-backed);
  `apps/mobile`'s web export target is therefore not a functional auth surface —
  expected and fine, since `apps/mobile`'s supported targets are iOS/Android only,
  and the real web surface is the separate `apps/web` app with its own
  httpOnly-cookie adapter appropriate for a browser.
- Image picking/upload uses `expo-image-picker` + `expo-file-system` to `PUT` directly
  to the presigned S3 URL obtained from the API, same flow as web.
- Env vars follow Expo's `EXPO_PUBLIC_` prefix convention for anything bundled into the
  client, validated at startup through `packages/config`.

### 5.4 Realtime Transport — Server-Sent Events (implemented Milestone 22)

Retrofits Milestone 16's poll-based notification badge and Milestone 21's poll-based
"new message" detection with a real push transport, once there were genuinely **two**
real consumers needing it — not built speculatively ahead of either.

- **SSE over WebSocket.** Both existing consumers are purely server→client pushes; the
  client always mutates over the existing REST endpoints, never over the realtime
  channel itself. SSE's one-directional model is an exact fit, and NestJS has it built
  in (`@Sse()`, `@nestjs/common`) — zero new backend dependencies, versus
  `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` (three new
  dependencies) for bidirectional capability nothing here uses. If a future feature
  genuinely needs the client to push over the realtime channel (typing indicators, for
  example), that's the point to revisit this decision, not before.
- **`GET /events`** (`apps/api/src/modules/events`, docs/API.md §18): one long-lived
  stream per connected client, guarded by the same `JwtAuthGuard` every other
  authenticated route uses. A 20s heartbeat comment keeps intermediary proxies from
  treating an idle-but-healthy connection as dead; the server closes the connection
  itself after ~10 minutes to force a periodic reconnect (re-running the guard), well
  inside the access token's 15-minute TTL — this is what closes the gap a revoked
  `tokenVersion` (§7) would otherwise leave on an indefinitely-long-lived stream.
- **Fan-out**: an in-process RxJS `Subject` (`EventsService`), filtered per-subscriber
  by recipient id — the same "in-process is fine for MVP single-instance scale"
  trade-off `NotificationsProcessor`/`ThrottlerModule` already make (not Redis pub/sub).
  `NotificationsProcessor` emits after writing a `Notification` row; `ConversationsService
  .sendMessage` emits to the other participant(s) after writing a `Message` row — both
  reuse their existing REST response shape verbatim as the pushed payload
  (`RealtimeEvent`, `packages/validation/src/lib/realtime.ts`), not a parallel "live"
  type.
- **Auth is the one place web and mobile genuinely diverge**, because neither a
  browser's native `EventSource` nor `react-native-sse`'s drop-in can attach a header
  the way `fetch` does — except `react-native-sse` actually can, which is why mobile
  uses it instead of the platform-native `EventSource`:
  - **Mobile** connects directly to `apps/api`'s `GET /events` with a genuine
    `Authorization: Bearer` header (`apps/mobile/src/lib/realtime.ts`) — the same
    direct-to-API shape every other mobile request already uses.
  - **Web** cannot do this: this app's access token is never exposed to browser JS in
    the first place (§7 — only an httpOnly refresh cookie), so a browser-native
    `EventSource` pointed at the API would have no credential to send even if it could
    set headers. `apps/web/src/app/api/events/route.ts` is a Route Handler that does
    what the Next server already does for every other request — acts as the one
    trusted caller holding a real Bearer token — except here it forwards a live stream
    instead of a single JSON response, and the browser's `EventSource` connects to
    this same-origin proxy route instead of the API directly.
- **REST stays authoritative.** This channel is a push *optimization*, not a
  guaranteed-delivery replacement for REST: a client reconnects (initial mount, or
  after any drop) and re-fetches the relevant REST endpoint to catch up on whatever it
  missed while disconnected, rather than assuming zero missed events or trying to
  replay by SSE event id. `NotificationBadge`/`ConversationsList`/`MessageThread`
  (and their mobile equivalents) all follow this shape: apply a pushed event
  immediately when connected, and re-fetch on every (re)connect.

### 5.5 UI Styling & Design System (planned, Milestones 23–26)

**Not implemented yet.** This section records the decisions the styling track
(`IMPLEMENTATION_PLAN.md` M23–M26) will implement. Today `apps/web` is unstyled HTML
plus the Nx generator's placeholder `global.css`, and `apps/mobile` uses
per-component `StyleSheet`s.

**Goal:** both apps look as alike as their platforms allow: same colors, type scale,
spacing, icons, and component shapes. Each still follows its own platform's
navigation conventions.

**Libraries** (verified current on 2026-10-09; reconfirm at M23's start, risk #9):

| Role                     | Web                                                                                         | Mobile (closest equivalent)                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Material component kit   | `@mui/material` **9.x** (v9.0 released 2026-04-08; there is no v8, since MUI skipped it to align with MUI X v9). Still Emotion-based (`@emotion/react`, `@emotion/styled`) | `react-native-paper` **5.x** (latest stable 5.15.x; 6.0 is alpha and not used)                                |
| Next.js integration      | `@mui/material-nextjs` 9.x: `AppRouterCacheProvider` with `enableCssLayer: true`            | n/a                                                                                                             |
| Utility-class styling    | `tailwindcss` **4.x** + `@tailwindcss/postcss`, declared in the root `package.json`         | `nativewind` **4.x** (current stable), which requires Tailwind **v3** (`^3.4`), declared in `apps/mobile/package.json` |
| Icons                    | `@mui/icons-material` (Google Material Icons)                                               | `@expo/vector-icons` `MaterialIcons` (the same icon set; already installed)                                     |
| Font                     | Inter via `next/font/google`                                                                | Inter via `@expo-google-fonts/inter` + `expo-font`                                                              |

Not chosen, and why: NativeWind 5, which would match web's Tailwind v4, is a release
candidate targeting Expo SDK 57 / React Native 0.86, and NativeWind's own docs say it
isn't production-ready. This project is on SDK 56, so v4 it is (risk #15).

**How the pieces combine:**

- **Tokens.** `packages/design-tokens` exports plain objects (semantic colors, type
  scale, 4 px spacing base, radii, icon sizes, layout widths), the only place a color
  or size value is defined. It contains no framework code, which keeps it a
  `scope:shared`/`type:util` package.
- **Web layering.**
  - The MUI theme is built from the tokens with `cssVariables: true`, so MUI emits
    `--mui-*` CSS variables.
  - `global.css` declares `@layer theme, base, mui, components, utilities;` before
    `@import 'tailwindcss';`. That puts MUI's styles in a layer below Tailwind
    utilities, so a utility class overrides MUI's defaults without `!important`.
  - Tailwind's `@theme inline` maps its color names to MUI's variables, so both
    libraries read one runtime value.
  - Tailwind preflight is the only CSS reset. MUI's `CssBaseline` is not used.
- **Web and Server Components.** MUI ships its components with `"use client"`, so
  Server Component pages can render them directly; pages don't gain `"use client"` just
  to be styled. Props crossing that boundary must be serializable, so no `sx` callback
  functions and no render-function children from a Server Component. The theme
  object, which contains functions, is created in one client module only.
- **Mobile layering.**
  - Paper components are styled through the Paper theme: `MD3LightTheme` with colors,
    `roundness` and fonts overridden from the tokens, and `MaterialIcons` as its icon
    provider.
  - NativeWind classes style only core React Native elements (`View`, `Text`,
    `Pressable`, `FlatList` containers). Paper components are not wrapped with
    NativeWind's `cssInterop`; two styling systems on one component is how drift
    starts.
  - Expo Router's tab and stack chrome get token colors through `screenOptions`, not
    Paper's `adaptNavigationTheme`. That function causes a type mismatch with SDK 56's
    `expo-router/react-navigation` imports (callstack/react-native-paper#4967), and its
    workaround is an `any` cast, which `CLAUDE.md` forbids.
- **Two Tailwind majors side by side.** Web's v4 sits in the root `package.json`;
  mobile's v3 is pinned in `apps/mobile/package.json`. pnpm's isolated `node_modules`
  gives each app its own copy. Verify with `pnpm --filter mobile why tailwindcss`.
  Class names are not guaranteed to render identically across v3 and v4 (risk #15).

**Component parity map** (use these pairings so the same UI element looks and behaves
the same on both platforms):

| UI element                       | Web (MUI + Tailwind)                                         | Mobile (Paper + NativeWind)                                   |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Primary / secondary button       | `Button` `variant="contained"` / `"text"`                    | `Button` `mode="contained"` / `"text"`                        |
| Text field                       | `TextField` `variant="outlined"`                             | `TextInput` `mode="outlined"`                                 |
| Field / form error               | `TextField` `helperText` + `error`, or `Alert`              | `HelperText type="error"`                                    |
| Icon action (like, save, ...)    | `IconButton` + `@mui/icons-material`                         | `IconButton` + `MaterialIcons`                                |
| Avatar                           | `Avatar`                                                     | `Avatar.Image` / `Avatar.Text`                                |
| List row (followers, inbox, ...) | `List` + `ListItemButton` + `ListItemAvatar`                 | `List.Item` with an avatar on the left                        |
| Unread count                     | `Badge`                                                      | `Badge`                                                       |
| Progress                         | `CircularProgress` / `LinearProgress`                        | `ActivityIndicator` / `ProgressBar`                           |
| Loading placeholder              | `Skeleton`                                                   | Token-colored placeholder `View` (Paper has no skeleton)      |
| Confirmation                     | `Dialog`                                                     | `Portal` + `Dialog`                                           |
| Transient message                | `Snackbar`                                                   | `Snackbar`                                                    |
| Primary navigation               | Left rail at `md`+, bottom bar below `md` (Tailwind layout)  | Expo Router `Tabs`, token colors + `MaterialIcons`            |
| Layout, spacing, grids           | Tailwind utilities                                           | NativeWind utilities on core RN elements                      |

**Rules:**

1. Colors and sizes come from `design-tokens` only. From M26, a lint rule bans color
   literals in app source.
2. Accessible names are part of the contract. `apps/web-e2e` and the mobile Jest tests
   find elements by label, role and text, so an action rendered as an icon keeps its
   old name as `aria-label` / `accessibilityLabel`.
3. Light theme only. Dark mode is a later, additive change: a second palette under
   the same semantic token names.
4. Every mobile dependency must run in Expo Go for SDK 56 (pure JS, or a native module
   Expo Go already bundles), installed via `pnpm exec expo install`.

## 6. Shared Packages

Shared packages hold only things genuinely identical across runtimes: data shapes,
validation, wire-format clients, and config parsing. **No React DOM or React Native UI
components are shared** — Instagram's iOS/Android/web surfaces already look and behave
differently per platform (gesture handling, navigation chrome, safe areas, platform
conventions), and forcing one component layer onto both `react-dom` and `react-native`
either means adopting a cross-platform UI runtime (e.g. NativeWind/RN-Web-style
constraints) that fights each platform's idioms, or maintaining shim components that
provide little real leverage over just writing two small, idiomatic components. If a
strong, concrete need for shared UI emerges later (e.g. a design-token package driving
both Tailwind config on web and a theme object on mobile), that's a narrow, additive
package — not a shared component library.

**That need has now arrived (planned, Milestones 23–26):** the styling track adds
exactly that narrow package, `packages/design-tokens`. It holds plain token objects;
each app turns them into its own MUI/Paper themes and Tailwind configs. Components
stay per-platform, as this section argues. See §5.5.

| Package         | Contains                                                                                                                                                                                                                    | Depended on by                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `types`         | Framework-agnostic TS types/enums not derivable from Zod alone (e.g. discriminated unions for notification payloads, pagination envelope generics)                                                                          | `validation`, `api-client`, `api`, `web`, `mobile` |
| `validation`    | Zod schemas for every request/response body and query string (`RegisterInputSchema`, `CreatePostInputSchema`, `PostResponseSchema`, ...); schemas are the source both Nest DTOs and client-side form validation derive from | `api-client`, `api`, `web`, `mobile`               |
| `api-client`    | Typed REST client: one function per endpoint, generated method signatures from the OpenAPI spec, hand-written transport (fetch + auth-refresh interceptor + retry-once-on-401 logic + pagination helpers)                   | `web`, `mobile`                                    |
| `config`        | `zod`-validated env schema per app (`ApiEnvSchema`, `WebEnvSchema`, `MobileEnvSchema`) and a small `loadEnv()` helper that throws a readable error on startup if env vars are missing/invalid                               | `api`, `web`, `mobile`                             |
| `eslint-config` | Shared flat ESLint config (base + per-framework overrides for Next/Nest/Expo) and shared Prettier config                                                                                                                    | every project via root config                      |
| `design-tokens` | **(planned, Milestone 23)** Framework-agnostic visual tokens: semantic colors, font family + type scale, spacing, radii, icon sizes, layout widths. No MUI/Paper/Tailwind code; adapters live in each app (§5.5)         | `web`, `mobile`                                    |

### 6.1 Why `types` _and_ `validation` (not just one)

Zod schemas already produce static types via `z.infer<>`, so most types are just
`export type X = z.infer<typeof XSchema>` re-exports from `validation`. `types` exists
for the residual cases where a type is needed without runtime validation baggage (e.g. a
type describing a Prisma-derived read model used only inside `api`) or where a shape is
inherently a TS-only construct (discriminated unions over branded ID types). Keeping them
as two packages (rather than folding `types` into `validation`) lets `api-client` and
UI code depend on `types` without pulling `zod` into a bundle where it isn't needed for
validation, and keeps the dependency direction explicit: `validation` depends on `types`
for shared primitives (e.g. a `Cursor` type), never the reverse.

### 6.2 Why REST + hand-written client instead of tRPC-style inference

The requirements specify REST explicitly (mobile clients, third-party integration
potential, and simple caching/CDN semantics favor REST over RPC-style coupling). To
still get end-to-end type safety without hand-duplicating every DTO:

1. `packages/validation` defines the request/response Zod schemas.
2. `apps/api` DTOs are generated from those same schemas via `nestjs-zod`
   (`createZodDto`), so the Nest layer and the shared package can never drift silently —
   a schema change is a single edit.
3. `@nestjs/swagger` + `nestjs-zod`'s OpenAPI conversion emit `openapi.json` as part of
   the `api` build.
4. `packages/api-client` runs `openapi-typescript` against that spec (an Nx target with
   `dependsOn: ["api:build"]`) to generate response/request **types**, which the
   hand-written fetch wrapper's methods are declared against. The wrapper itself
   (auth refresh, retries, pagination cursors, error unwrapping) is hand-written once
   and shared by web and mobile, rather than regenerated, since that logic is
   business/transport logic, not a wire shape.

This keeps exactly one authored source of truth (`packages/validation`) for shapes, one
generated artifact (`openapi.json`) as the contract, and one hand-written, testable
transport layer — see the risk register for what happens if this pipeline breaks.

## 7. Authentication & Session Architecture

- **Access token**: short-lived JWT (15 minutes), signed with `HS256` (symmetric —
  implemented Milestone 5; the original draft here specified an asymmetric algorithm
  such as `RS256`/`EdDSA` so a public key could later verify tokens outside the API
  process. Only one process ever verifies access tokens today — a custom `JwtAuthGuard`
  in the same `apps/api`, not a separate resource server — so asymmetric signing would
  buy nothing yet; revisit if a second verifying service appears). Payload is
  `{ sub, tokenVersion }` plus the standard `iat`/`exp` claims; `tokenVersion` is checked
  against the `User` row on every request so bumping it (e.g. after a password change)
  invalidates all of that user's outstanding access tokens without an allowlist.
- **Optional auth** (`OptionalAuthGuard`, implemented Milestone 8): for routes that
  behave differently when authenticated but don't require it (`GET /users/:username`
  — `docs/API.md` §4) — shares `JwtAuthGuard`'s own token-verification logic
  (`resolve-authenticated-user.ts`) but never rejects the request; a missing or
  invalid token just means an anonymous viewer. `AuthModule` exports both guards for
  other domain modules to `@UseGuards()` with — exporting the guard classes alone
  wasn't enough for this to work cross-module: Nest constructs a guard fresh in the
  _consuming_ module's injector, so `JwtModule` (which both guards depend on for
  `JwtService`) had to be exported from `AuthModule` too, not just the guards
  themselves. First surfaced, and fixed, when `UsersModule` became the first module
  besides `auth` to use either guard.
- **Refresh token**: opaque, high-entropy random string (not a JWT — nothing to decode,
  so a leaked DB doesn't hand out a forgeable format), sent to the client once, and
  stored **hashed** (e.g. SHA-256, since it's already high-entropy — no need for a slow
  KDF here) in a `RefreshToken` table (see `DATABASE.md`).
- **Rotation with reuse detection**: every `/auth/refresh` call consumes the presented
  refresh token and issues a brand-new one in the same "family" (`familyId` shared
  across all tokens descended from one login). If a refresh token is presented that has
  already been rotated away (i.e. it's marked `revokedAt` but someone still tries to use
  it), the **entire family is revoked**, forcing re-authentication on every device using
  that family — this is the standard mitigation for stolen-refresh-token replay.
- **Storage per client** (`api-client`'s `TokenStorage` interface —
  `packages/api-client/src/lib/token-storage.ts` — abstracts this; see §6.2/risk #5):
  - **Web (implemented Milestone 6, revised from this section's original draft)**: the
    API still sets its own httpOnly/Secure/SameSite=Lax refresh cookie, scoped to
    `/api/v1/auth` on _the API's own origin_ — but nothing in this design actually
    reads it, because the browser never calls the API directly. Instead, `apps/web`'s
    Next server calls the API server-to-server, the same way `mobile` does (an explicit
    `refreshToken` in the request body — the API always includes one in its responses
    specifically so this doesn't need a client-type signal, docs/PROGRESS.md's
    Milestone 5 deviation), and keeps its **own** single httpOnly/Secure/SameSite=Lax
    session cookie on `apps/web`'s own origin (`Path=/`), holding both tokens as one
    JSON value. This sidesteps a real problem the original cross-origin-cookie design
    had: `web` and `api` run on different ports/origins in dev (and would need a shared
    parent domain in production to share a cookie at all), and even then, a browser
    request's `Cookie` header is matched by path, not by which server ultimately
    handles it — a Server Action POST doesn't go to `/api/v1/auth/*`, so the API's
    narrowly-scoped cookie would never actually reach `apps/web`'s server. Storing the
    access token too (not just the refresh token) lets a plain page render reuse a
    still-valid one without refreshing; `proxy.ts` (Next 16's renamed `middleware.ts`)
    proactively rotates it once it's actually expired, since `cookies()` can only be
    _written_ from a Server Action/Route Handler, never a plain render — see
    `apps/web/src/proxy.ts` for the full reasoning and the race-condition analysis for
    why it only refreshes on genuine expiry, not on every request.
  - **Mobile (implemented Milestone 7)**: both tokens stored together via
    `expo-secure-store`; refresh is triggered by `HttpClient`'s 401-retry interceptor,
    identical logic to web modulo the storage adapter — no
    read-only-outside-Server-Actions restriction exists on-device, so this one stayed
    exactly as originally designed, with zero changes needed to `HttpClient`/
    `AuthClient` themselves. Confirms the `TokenStorage` interface genuinely is
    storage-adapter-agnostic (risk #5): two structurally different implementations
    (cookie-per-request on web, a module-level singleton on mobile) both work against
    the same shared transport.
  - **CSRF**: `apps/web`'s session cookie is `SameSite=Lax`, so it isn't sent on a
    cross-site `POST` at all — a forged form submission to a Server Action from another
    site carries no session, regardless of that action's own logic. This is actually a
    simpler guarantee than the original draft's (which reasoned about the API's own
    cookie specifically); it's moot for the API's refresh cookie now, since nothing ever
    submits a cross-site request to the API directly in this design.
- **Logout**: revokes the presented refresh token (and, for "log out everywhere",
  revokes the whole family / all families for the user).
- Password hashing: `argon2id` (via `argon2` package), not bcrypt, for new-project
  defaults in 2026.

## 8. Media Storage Architecture (implemented Milestone 9)

1. Client requests an upload slot: `POST /api/v1/media/presign` with declared
   `contentType`, `byteSize`, and `purpose` (`AVATAR` | `POST_IMAGE`). The API validates
   type/size limits server-side (not trusted from the client at read time) and returns a
   presigned S3 `PUT` URL plus a `mediaId` for a `Media` row created in `PENDING` status.
2. Client uploads bytes **directly to the bucket** using that URL — the API process
   never sees the file body.
3. Client confirms: `POST /api/v1/media/:id/complete`. The API verifies the object now
   exists in the bucket (a `HEAD` request) and enqueues a BullMQ job to generate
   derived variants (e.g. `thumbnail` 150px, `feed` 1080px, keeping the original) using
   `sharp`, writing each variant back to the bucket under a deterministic key and
   updating `Media.status` to `READY` (or `FAILED` with a reason) when done.
4. Only `READY` media may be attached to a `Post` or set as a profile avatar; the create-
   post endpoint rejects `mediaId`s that aren't the uploading user's own and aren't
   `READY`.
5. Reads: the API stores S3 object keys, not public URLs, and resolves them to URLs at
   response time (either a CDN domain in front of the bucket, or short-lived signed GET
   URLs if the bucket stays private) — this indirection is what lets storage
   configuration change without a data migration.

Locally, MinIO (S3 API-compatible) runs in Docker Compose with a bucket bootstrapped on
startup; production targets any S3-compatible provider (AWS S3, Cloudflare R2,
Backblaze B2) by swapping endpoint/credentials in `packages/config` — the application
code only ever uses the AWS SDK v3 S3 client with a configurable `endpoint`.

**As implemented:**

- The BullMQ processor (`MediaProcessor`, `apps/api/src/modules/media/media.processor.ts`)
  runs **in-process** within `apps/api`, registered inside `MediaModule` itself, exactly
  as this section's risk #4 anticipated — not a separate worker app. The variant-generation
  step itself (`generateMediaVariants`, `media-variants.ts`) is a pure function with no
  S3/Prisma/BullMQ knowledge, kept separate specifically so it can be unit-tested against a
  fixed input buffer in isolation from the processor's I/O.
- `thumbnail` (150×150) is always a square center-crop (`sharp`'s `fit: 'cover'`) —
  applied uniformly regardless of `purpose`, not just for `AVATAR`. This is also what makes
  the web upload path safe without a custom crop widget: `docs/FEATURES.md` #4's
  "square crop performed client-side" only has a real implementation on mobile
  (`expo-image-picker`'s native `allowsEditing`/`aspect: [1,1]`); web has no comparable
  free native cropper, so it relies entirely on this server-side crop instead. `feed`
  (capped at 1080px on its longest side, `fit: 'inside'`, never upscaled) preserves the
  original aspect ratio.
- A `blurhash` (via the `blurhash` package, computed from a 32×32 raw-pixel downsample) is
  generated alongside the variants and stored on `Media.blurhash`, per `docs/DATABASE.md`
  §3.3 — not yet consumed by any client UI (no progressive-loading placeholder exists
  until posts/feed rendering lands).
- `@nestjs/bullmq` (the official Nest wrapper, not raw `bullmq` driven directly) is used
  for the queue/worker — consistent with this codebase's established preference for
  official `@nestjs/*` wrappers (`@nestjs/throttler`, `@nestjs/jwt`, `@nestjs/swagger`).
  Pinned to `12.0.0`, the latest version — unlike those other packages, `@nestjs/bullmq`'s
  `12.x` peer range already includes `@nestjs/core ^11.0.0`, so (unusually) the latest
  version needed no downgrade to stay on this repo's Nest 11 line.
- `PATCH /me/avatar`'s response is the `Media` resource itself (`MediaResponse`), not
  `UserResponse` — `docs/API.md` §3 explicitly documents `UserResponseSchema` as never
  including `avatarUrl`, so returning the just-set media (with its resolved variant URLs)
  avoids widening that schema's documented contract while still giving the client
  everything it needs to update its UI immediately.

## 9. Local Development Environment

`docker-compose.yml` at the repo root provides infrastructure only (never application
code, which runs via Nx on the host for fast iteration):

| Service    | Image                 | Purpose                                                                                   |
| ---------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `postgres` | `postgres:17-alpine`  | Primary database                                                                          |
| `minio`    | `bitnamilegacy/minio` | S3-compatible object storage + `bitnamilegacy/minio-client` init container for the bucket |
| `redis`    | `redis:7-alpine`      | BullMQ job queue, throttler storage                                                       |
| `maildev`  | `maildev/maildev`     | Catches outbound email locally (password reset, etc.)                                     |

**`minio`/`minio-init` pinned to `bitnamilegacy/*` images, not the official `minio/minio`/
`minio/mc` (corrected after Milestone 20's CI pipeline hit this on its very first real
GitHub Actions run — see `docs/PROGRESS.md`'s Milestone 20 Known Issues/Bugs Found):**
MinIO withdrew its images from Docker Hub (2026-09-11), then `quay.io/minio/*` _also_
started rejecting anonymous pulls with `401 unauthorized` starting 2026-09-24 — every
registry MinIO itself controls became a closed source for an anonymous CI pull
simultaneously. `bitnamilegacy/minio`/`bitnamilegacy/minio-client` are Broadcom's frozen,
still-publicly-pullable archive of pre-lockdown Bitnami MinIO builds — the fix dozens of
independent projects converged on for the same breakage. Two real consequences of the
switch: the Bitnami image stores data under `/bitnami/minio/data`, not `/data` (the
compose file's `minio_data` volume mount changed to match — a pre-existing `minio_data`
volume from the old root-owned official image will _not_ be writable by the Bitnami
image's non-root user; remove and let Compose recreate it if upgrading an existing local
environment), and `mc` calls from the init container need an explicit `--config-dir`
(that same non-root-user restriction). A startup-race retry loop was also added to
`minio-init`'s entrypoint: `minio`'s healthcheck can report healthy a moment before the
server actually accepts connections from _other_ containers on the Docker network, which
`depends_on: condition: service_healthy` alone doesn't fully cover — confirmed
reproducible, not theoretical.

`.env.example` at the root documents every variable consumed by `packages/config`;
each app loads only the subset it needs, validated at boot.

## 10. Testing Strategy

| Layer           | Tool                                                                                                                        | Scope                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Unit            | Vitest                                                                                                                      | `packages/*` (pure functions, schema validation), Nest services/pipes in isolation (mocked Prisma), React component logic       |
| API integration | Nest `@nestjs/testing` + Supertest, against a real Postgres (a dedicated `test` database, migrated fresh per run) and MinIO | `apps/api-e2e` — full HTTP request → DB round trip per endpoint                                                                 |
| Web E2E         | Playwright                                                                                                                  | `apps/web-e2e` — critical user journeys (register→login, create post, follow, like, comment) against a running web+api+db stack |
| Mobile          | Jest + React Native Testing Library                                                                                         | Component/unit level only in the MVP; full device E2E (Detox/Maestro) is a future addition, not required by this phase          |

Every Nx project exposes `test`/`lint` targets; `build`/`test` for `api` depend on
Prisma Client generation being up to date. **CI implemented Milestone 20**:
`.github/workflows/ci.yml` runs `nx affected -t lint test build`, then
`apps/api-e2e`'s and `apps/web-e2e`'s (Chromium) `e2e` targets as their own steps, on
every PR and on push to `main`, reusing the same `docker-compose.yml` every local dev
environment already runs for Postgres/Redis/MinIO rather than re-declaring equivalent
service containers in the workflow itself. A separate, `continue-on-error: true`
matrix job runs the full `web-e2e` suite against Firefox and WebKit too — informational
only, not merge-blocking, since both have a measured higher flake rate than Chromium in
this environment (§12's risk register and `docs/PROGRESS.md`'s Milestone 18/20 Known
Issues have the specifics) — each matrix entry is its own fully isolated runner, which
is what actually resolves the register/login-throttle collision a single shared
long-lived server hit when exercising all three browsers together locally. Branch
protection requiring the `main` job to pass is a one-time GitHub repository setting,
not expressible in the workflow file itself — the workflow provides the check, branch
protection is what makes it actually gate merges.

## 11. Security Considerations

- All state-changing endpoints require the `Authorization: Bearer` access token;
  `ThrottlerModule` rate-limits auth endpoints aggressively (e.g. login/register/refresh)
  and all endpoints moderately.
- Helmet-equivalent security headers on the API (`helmet` Nest middleware); CORS locked
  to known web origins.
- Input validation on every endpoint via the shared Zod schemas (§5.2); Prisma
  parameterizes all queries, so SQL injection is not a realistic surface as long as raw
  `$queryRawUnsafe` is never used with unsanitized input (only the search feature is a
  candidate for raw SQL, and it should use `$queryRaw` tagged templates).
- Object storage buckets are private by default; media is served via CDN/signed URLs,
  never a public-write bucket.
- Secrets (`DATABASE_URL`, JWT signing keys, S3 credentials) only ever live in env vars
  validated by `packages/config`, never committed; `.env` is git-ignored, `.env.example`
  is committed.
- **Every claim above was verified live, not just read off this document, in Milestone
  20's hardening pass** (`apps/api-e2e/src/security/security.spec.ts` formalizes it):
  Helmet headers and the CORS allow-list are genuinely present/effective on real HTTP
  responses, not just configured-and-assumed; the global default (100/min/IP at the
  time, raised to 200/min/IP in Milestone 21 — see `docs/API.md` §1) and a
  stricter per-route override (`/auth/login`, 20/min/IP) both tag distinct
  `X-RateLimit-Limit` values and were independently confirmed, via manual live testing,
  to actually return `429` once exceeded; built client bundles (`apps/web/.next/static`,
  `apps/web/.next/server`, `apps/mobile/dist`'s Hermes bundles) were grepped for the
  `JWT_ACCESS_TOKEN_SECRET`/`DATABASE_URL`/S3-credential values and came back clean — the
  only place a secret value incidentally appears is Next's own internal
  `.next/cache/` build cache (never served to any client, already gitignored), not a
  real leak. `GET /health` is deliberately exempt from rate limiting (`@SkipThrottle()`)
  — a liveness/readiness endpoint must never be throttled, or routine load-balancer/
  orchestrator polling would produce false "unhealthy" signals.

## 12. Architectural Risks & Dependencies

Risks are ordered roughly by how early they need a decision, not by severity.

| #   | Risk / Dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Why it matters                                                                                                                                                                           | Mitigation / Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | **Prisma 7 is a major version with real breaking changes** (TypeScript query engine, mandatory driver adapters or explicit config in `prisma.config.ts`, explicit generated-client `output` path) relative to the Prisma most tutorials still show.                                                                                                                                                                                                                                                      | Getting the schema/config wrong blocks every other milestone, since everything depends on `prisma`.                                                                                      | **Resolved (Milestone 0/2).** Pinned to `prisma`/`@prisma/client`/`@prisma/adapter-pg` 7.10.0 (the actual latest stable — npm's `latest` dist-tag pointed at an 8.0 RC). `prisma.config.ts` + the `@prisma/adapter-pg` driver adapter confirmed working against Postgres in Milestone 0; the first real migration (`User`/`RefreshToken`, including a hand-added `CREATE EXTENSION citext`) applied cleanly in Milestone 2 using `@default(uuid(7))` for ids. See `docs/PROGRESS.md`.                                                                                                                                                                                      |
| 2   | **OpenAPI → `api-client` codegen pipeline is a build-order dependency**: `api-client`'s generated types require `api`'s `openapi.json`, which requires `api` to build/boot.                                                                                                                                                                                                                                                                                                                              | If this Nx `dependsOn` wiring is wrong, web/mobile silently build against stale types.                                                                                                   | **Resolved (Milestone 6).** `api-client:generate-types` → `api:generate-openapi` → `prisma:generate` is wired via Nx `dependsOn`, verified by an actual Nx run rather than just declared. Both artifacts are gitignored and regenerated fresh every run (like `prisma/generated/`) rather than committed-and-diff-checked — simpler, and can't go stale by definition, so the originally-proposed CI staleness check is unnecessary rather than deferred. See `docs/API.md` §15.                                                                                                                                                                                           |
| 3   | **Feed fan-out strategy (read-time vs write-time)**: MVP uses fan-out-on-read (`WHERE authorId IN (following)`), which is simple and correct but degrades for accounts following thousands of people or being followed by many (hot-row contention on write, expensive `IN` scans on read).                                                                                                                                                                                                              | Directly affects `Post`/`Follow` indexing decisions in `DATABASE.md` and the feed endpoint's query plan.                                                                                 | **Exercised for real (Milestone 12).** `GET /feed` fetches the caller's `following` ids (one query against `Follow`'s PK-served `followerId` prefix), then `Post.findMany({ authorId: { in: followingIds } })` — two round trips, not Prisma's nearest single-query equivalent (a relation `some` filter), a deliberate choice to match `DATABASE.md` §6's literal documented query shape exactly. At seed/test scale this is fast and the query plan is unsurprising; no query-plan surprises forced a design change, so fan-out-on-read stands as originally decided — revisit with a precomputed feed table only once real usage (not MVP test data) shows otherwise.   |
| 4   | **Background job execution model**: image-variant generation and notification fan-out run in-process inside `apps/api` for the MVP.                                                                                                                                                                                                                                                                                                                                                                      | Simplicity now vs. a scaling ceiling later (CPU-bound `sharp` work competing with the HTTP event loop process).                                                                          | **Both instances implemented.** `MediaProcessor` (Milestone 9) and `NotificationsProcessor` (Milestone 16) — both `@nestjs/bullmq` `@Processor`/`WorkerHost` providers running in-process, each on its own dedicated queue (`media`, `notifications` — not sharing one), confirming the pattern generalizes: isolated Nest providers, extractable into a standalone `apps/worker` later as a move, not a rewrite.                                                                                                                                                                                                                                                          |
| 5   | **Auth token storage differs by platform** (cookie on web vs SecureStore on mobile), so `api-client`'s refresh logic must be storage-adapter-agnostic from the start.                                                                                                                                                                                                                                                                                                                                    | Getting this wrong means duplicating auth logic later instead of sharing it.                                                                                                             | **Resolved (Milestone 6 web, Milestone 7 mobile).** `api-client`'s `TokenStorage` interface (`read`/`write`/`clear`) now has two real, structurally different implementations — `apps/web/src/lib/web-token-storage.ts` (per-request, cookie-backed, access token cached to work around a Next-specific write restriction — see §7) and `apps/mobile/src/lib/mobile-token-storage.ts` (a module-level singleton, SecureStore-backed, no such restriction) — with zero changes to `HttpClient`/`AuthClient` for either. The abstraction held.                                                                                                                               |
| 6   | **Case-insensitive uniqueness for username/email** needs either Postgres `citext` or normalized lowercase columns + unique index.                                                                                                                                                                                                                                                                                                                                                                        | Wrong choice now means a painful migration once real user data exists.                                                                                                                   | **Resolved (Milestone 2).** `citext` extension enabled in migration `0001_init_user_auth`; `User.username`/`User.email` are `@db.Citext`. See `docs/DATABASE.md` §1/§5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | **Search relevance** (`pg_trgm` similarity search) is adequate for MVP scale but not a real search engine.                                                                                                                                                                                                                                                                                                                                                                                               | Sets expectations for the "User search"/"Explore" features so nobody assumes Elasticsearch-quality ranking.                                                                              | Documented as an explicit MVP limitation in `FEATURES.md`; revisit with a dedicated search service only post-MVP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | **Nx module boundaries must be enforced from commit one**, not retrofitted.                                                                                                                                                                                                                                                                                                                                                                                                                              | Retrofitting boundary tags after `web` has accidentally imported a Nest service is a much bigger cleanup than starting correctly.                                                        | Boundary lint rule ships in Milestone 0, before any feature code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | **Framework version drift between design time and implementation time** (Next 16, NestJS 11, current Expo SDK, Prisma 7, Zod 4 all move fast).                                                                                                                                                                                                                                                                                                                                                           | This document may be read months after being written.                                                                                                                                    | Each milestone that first installs a given framework begins by checking that framework's current official docs rather than trusting this document's version numbers verbatim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | **Notification volume** for a popular account (many likes/comments/follows in a burst) could generate a write storm if notifications are created synchronously in the request path.                                                                                                                                                                                                                                                                                                                      | Latency spikes on `like`/`comment`/`follow` endpoints.                                                                                                                                   | Notification creation is enqueued via BullMQ on its own dedicated `notifications` queue (Milestone 16) — not reusing `media`'s — rather than written synchronously in the triggering request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 11  | **`redirect()` called inside a Server Action bound to `useActionState`, on a form resubmitted after that same action previously returned a normal (non-redirecting) state, doesn't reliably navigate the browser** — a confirmed, open upstream Next.js App Router limitation (vercel/next.js discussions #73199/#82080, issue #72842), reproduced independently of this codebase's own code, dev vs. production builds, and `redirect()` vs. a client-side `router.push`/`window.location` alternative. | Affects `login`/`register`/profile-edit/delete-account — any user who corrects a mistake and resubmits the same page would be stuck, not redirected, after the retry genuinely succeeds. | **Found, not fixed (Milestone 20)** — see `docs/PROGRESS.md`'s Milestone 20 Bugs Found/Known Issues for the full repro history. `apps/web-e2e/src/critical-path.spec.ts` works around it with a `page.reload()` between a failed and a corrected submission (both a reliable workaround and a realistic thing a stuck real user would do). A real client-side fix (e.g., abandoning `useActionState` for these four forms in favor of a plain client-submit-then-`router.push` pattern) is a reasonable follow-up once a future milestone has UI-polish scope, not pursued now since it touches four forms for a framework-level issue outside this milestone's own scope. **Scheduled: Milestone 26** (the styling track's polish pass, `IMPLEMENTATION_PLAN.md`). |     |
| 12  | **`EventsService`'s realtime fan-out (§5.4, Milestone 22) is in-process RxJS, not Redis pub/sub** — a client connected to one `apps/api` instance never sees an event emitted on another.                                                                                                                                                                                                                                                                                                                 | Breaks the moment `apps/api` runs as more than one instance (the same ceiling risk #4 already names for BullMQ processors, just for push instead of jobs).                              | Accepted for MVP single-instance scale. Not a silent correctness gap: REST stays authoritative (§5.4's "reconnect → re-fetch" contract), so a missed push on the wrong instance is recovered on the client's next reconnect, not lost. Revisit (Redis pub/sub, or a dedicated realtime-gateway process) only once `apps/api` is actually scaled past one instance.                                                                                                                                                                                                                                                                                                       |
| 13  | **Mobile's SSE client (`react-native-sse`) reconnects with the `Authorization` header it was constructed with**, not a freshly-read token — unlike the browser-native `EventSource` web uses via its proxy route, which re-authenticates through the Route Handler on every reconnect.                                                                                                                                                                                                                  | A connection that outlives its access token's validity (15 min) without anything else refreshing it will 401 on reconnect and keep retrying with the same stale token indefinitely.     | Accepted for MVP: the server's own forced ~10-minute disconnect (§5.4) is comfortably inside the 15-minute token TTL for a connection that was valid when opened, and ordinary app usage (any other REST call) independently refreshes the stored token. Documented, not solved, here — see `docs/PROGRESS.md`'s Milestone 22 Known Issues.                                                                                                                                                                                                                                                                                                                              |
| 14  | **MUI and React Native Paper follow different Material Design generations** (planned, §5.5): MUI v9's components are Material Design 2-based, while Paper v5's `MD3` themes are Material Design 3 (tonal surfaces, pill-shaped buttons, different elevation). | Left at defaults, the same "button" or "card" looks visibly different on web and mobile, which works against the styling track's main goal. | The tokens override what differs: radii (Paper `roundness`, MUI `shape`), colors (no MD3 tonal elevation tints; flat surfaces with token borders), and typography on both. The M26 parity review is the check. If a Paper component can't be made to match through its theme, fall back to a small NativeWind-styled core-RN component for that one element, not to `cssInterop` on Paper. |
| 15  | **Web uses Tailwind v4, mobile uses Tailwind v3** (planned, §5.5): NativeWind 4, the stable line, requires Tailwind v3; NativeWind 5, which supports v4, is a release candidate targeting Expo SDK 57. Some utility names and defaults changed between v3 and v4 (e.g. the `shadow`/`rounded` scales were shifted, and the default `ring` width changed). | The same class string can render differently on the two platforms, and two Tailwind versions must coexist in one pnpm workspace. | Share token names, not raw class strings: both configs expose the same token-backed custom names (`bg-primary`, `text-secondary`, ...), and visual sizes come from tokens rather than Tailwind's default scales. Tailwind v3 is pinned in `apps/mobile/package.json`, v4 at the root; check with `pnpm --filter mobile why tailwindcss`. Revisit (NativeWind 5 + Tailwind v4 on mobile) as part of a future Expo SDK 57 upgrade, once NativeWind 5 is stable. |
| 16  | **New UI dependencies vs. the pinned React and Expo Go** (planned, §5.5): the workspace forces `react@19.2.3` through `pnpm-workspace.yaml` `overrides` (react-native 0.85.3's renderer is locked to it), and mobile is tested in Expo Go for SDK 56, which only runs its own bundled native modules. | A library whose peer range excludes 19.2.3, or that needs a native module Expo Go doesn't ship, either breaks the install or crashes at runtime in Expo Go. | M23 checks every new package's peer ranges against 19.2.3 before installing and limits mobile additions to pure-JS libraries or Expo-Go-bundled native modules (`react-native-reanimated`, `expo-font`), installed via `pnpm exec expo install`. pnpm's `minimumReleaseAge` may block very fresh releases; use the newest version past that gate rather than adding exclusions. |

## 13. Open Questions (deferred, not blocking design)

- Deployment target (Vercel for web + containers for API vs. all-container) is left
  unspecified — nothing in this architecture assumes one, since apps only need to know
  their own env vars and a reachable API URL / DATABASE_URL.
- Email delivery provider for production (Maildev is dev-only) is deferred to
  whichever future milestone first adds a forgot-password/email-based reset flow —
  **corrected in Milestone 20**: this was originally expected to be the Account
  Settings milestone, but Milestone 19's actual scope (`docs/API.md` §13) turned out
  to be authenticated-only password/email changes, never needing to send email at
  all. No forgot-password flow is scheduled yet (see `docs/PROGRESS.md`'s Milestone
  19 Known Issues).
- Content moderation / reporting is out of scope for the listed MVP feature set and not
  designed here; if required later it would be a new `reports` domain module, not a
  change to existing ones.
