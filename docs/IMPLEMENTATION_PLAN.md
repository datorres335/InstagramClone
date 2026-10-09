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

**Decision (made in Milestone 20 itself, per this section's own instruction): Direct
Messages next, M21.** Of the four candidates, DMs is the only one that's core,
expected social-app functionality rather than a specialized content format (Stories/
Reels) or a cross-cutting infra upgrade with no feature of its own (push/realtime) —
and realtime transport is better justified as the infrastructure _that DMs needs_
(see M22 below) than as a standalone milestone with nothing concrete driving it yet.
See `docs/PROGRESS.md`'s Milestone 20 Architectural Decisions entry for the full
reasoning.

### M21 — Direct Messages (Foundation)

- Schema: decide 1:1-only vs. group-capable up front (`DATABASE.md`'s own "decide the
  real schema before implementing" discipline) — a `Conversation` +
  `ConversationParticipant` join table supports both without a later migration;
  a bare `Message(senderId, recipientId)` pair only supports 1:1 and would need a
  breaking schema change to ever add group chat. Recommend the join-table shape even
  for a 1:1-only MVP, given how cheap that optionality is to keep open now.
  `Message(conversationId, senderId, body, readAt, createdAt)`.
- API: `POST /conversations` (idempotent for the same pair of participants, mirroring
  `Follow`'s self-referential dedup precedent — starting a conversation with someone
  you already have one with returns the existing one, not a duplicate), `GET
/conversations` (inbox list, newest-activity-first), `GET /conversations/:id/messages`
  (cursor-paginated), `POST /conversations/:id/messages`. Authorization: a participant
  can only read/post to conversations they're actually in — the first endpoint in this
  codebase needing a "many-to-many membership" check rather than single-owner
  (`author.id === viewer.id`) or follow-based authorization.
- Web + mobile: an inbox list screen + a conversation thread view. Still poll-based for
  new-message detection (matching `Notification`'s own MVP choice, `ARCHITECTURE.md`
  §10) — explicitly **not** bundling realtime transport into this same milestone; see
  M22.
- **Tests**: conversation-creation idempotency for the same participant pair; message
  pagination; a non-participant rejected from reading/posting to a conversation they're
  not in (`403`, the first test of this specific authorization shape).

### M22 — Realtime Transport (SSE, decided below)

- Retrofits `Notification`'s poll-based unread count (Milestone 16) and M21's
  poll-based new-message detection with a real push transport — explicitly deferred
  until there are _two_ real consumers needing it (the same "don't build shared
  infrastructure for a single, hypothetical consumer" discipline this codebase has
  followed since Milestone 2's `pg_trgm` deferral), not attempted alongside either
  feature individually.
- Decide WebSocket (`@nestjs/websockets`) vs. SSE before implementing — SSE is simpler
  (plain HTTP, no new protocol) but one-directional (fine for "new message/notification
  arrived" pushes, not for anything needing the client to send over the same channel);
  re-derive which this codebase actually needs rather than assuming either.

**Decision (made in Milestone 22 itself, per this section's own instruction): SSE,
not WebSocket.** Both real consumers (`Notification`'s unread count, `Message`'s
new-message detection) are purely server→client pushes; the client already mutates
everything over the existing REST endpoints and never needs to send over the realtime
channel itself, so SSE's one-directional model is a complete fit, not a compromise.
NestJS ships `@Sse()` in `@nestjs/common` already — zero new backend dependencies —
versus `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` (three new
dependencies) for bidirectional capability nothing in this MVP uses. Implemented as
`GET /events` (`docs/API.md` §18), with an in-process RxJS `Subject` for fan-out
(the same single-instance MVP trade-off `NotificationsProcessor`/`ThrottlerModule`
already make) and a Route-Handler proxy for web's auth specifically, since neither a
browser-native `EventSource` nor this app's httpOnly-cookie-only token model lets the
browser attach a real `Authorization` header the way mobile's `react-native-sse`
client can. Full reasoning in `docs/ARCHITECTURE.md` §5.4; see `docs/PROGRESS.md`'s
Milestone 22 entry for what's next.

## Styling Track (M23–M26)

Every screen built so far is functionally complete but visually unstyled: `apps/web`
uses plain HTML elements with a few inline `style={{}}` props, and its
`src/app/global.css` is still the Nx generator's placeholder stylesheet. `apps/mobile`
uses per-component React Native `StyleSheet`s with hard-coded colors. M23–M26 give
both apps one consistent, Instagram-like visual design **before** any further feature
work. Push notifications, previously recommended as M23 in `docs/PROGRESS.md`, moves
to M27.

**Decisions** (the full record, with the component parity map and verified versions,
is in `ARCHITECTURE.md` §5.5):

- **Web**: Material UI v9 (`@mui/material`, Emotion, `@mui/material-nextjs`,
  `@mui/icons-material`) for components, and Tailwind CSS v4 for layout, spacing and
  grids. The two are combined with CSS cascade layers (`mui` ordered before
  `utilities`), so a Tailwind class always wins over MUI's default styles.
- **Mobile, the closest equivalents**: React Native Paper v5 (Material Design
  components for React Native) in place of MUI, and NativeWind v4 (Tailwind for React
  Native) in place of Tailwind. Icons come from `@expo/vector-icons`' `MaterialIcons`,
  the same Google Material icon set as `@mui/icons-material`.
- **One source of visual truth**: a new `packages/design-tokens` package (colors, type
  scale, spacing, radii, icon sizes, layout widths). Each app adapts those tokens into
  its own MUI theme, Paper theme and Tailwind config. UI components are still **not**
  shared between web and mobile (`ARCHITECTURE.md` §6). Tokens are the narrow, additive
  package that section already anticipated.

**Rules for every milestone in this track:**

1. **Presentation only.** No API, database, validation or business-logic changes. If
   a screen needs data it doesn't have, that is a separate feature, not styling scope.
2. **Accessible names don't change.** `apps/web-e2e` finds elements by label, role and
   text (`getByLabel('Email')`, `getByRole('button', { name: 'Unlike' })`,
   `getByText(/Notifications \(\d+\)/)`, and so on), and mobile tests use
   `getByLabelText`/`getByText`. An action that becomes an icon keeps its old name as
   its `aria-label`/`accessibilityLabel`. Tests are not edited to fit the new markup
   unless the markup change is a genuine improvement, and then the replacement
   assertion must check the same behavior (`CLAUDE.md`: never weaken tests).
3. **Light theme only.** Dark mode is out of scope for this track. Tokens use semantic
   names (`text`, `surface`, `border`, ...) rather than raw color names, so a dark
   palette can be added later without renaming anything.
4. **Expo Go stays usable.** Every mobile dependency must run in Expo Go for SDK 56:
   pure-JS libraries, or native modules Expo Go already bundles. Install them with
   `pnpm exec expo install` so they get SDK-56-matched versions.
5. **Versions are reconfirmed at M23's start** (Principle 5), including peer ranges
   against the workspace's exact `react@19.2.3` override (`pnpm-workspace.yaml`) and
   pnpm's `minimumReleaseAge` gate, which blocks packages published too recently.

```
M22 ─▶ M23 Design system foundation + shells + auth screens
                 │
          ┌──────┴──────┐
          ▼             ▼
   M24 Feed, posts,   M25 Discovery, activity,
       profiles           messages, settings
          └──────┬──────┘
                 ▼
          M26 Consistency + polish pass ─▶ M27 Push notifications
```

M24 and M25 depend only on M23 and touch disjoint screens, so either can go first.

### M23 — Design System Foundation, App Shells + Auth Screens

- **Confirm versions first**: `@mui/material`, `@mui/material-nextjs`,
  `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `tailwindcss` +
  `@tailwindcss/postcss` (web); `react-native-paper`, `nativewind`, the Tailwind v3
  release NativeWind v4 requires, `react-native-reanimated`, `expo-font`,
  `@expo-google-fonts/inter` (mobile). Check each against Next 16.3, Expo SDK 56 /
  React Native 0.85.3 and React 19.2.3, and record the exact versions in
  `docs/PROGRESS.md`.
- **`packages/design-tokens`** (`@nx/js:lib`, tags `scope:shared`, `type:util`, no
  runtime dependencies). It exports plain TypeScript objects:
  - semantic colors: primary action blue, text, secondary text, border, background,
    surface, error/like red, success
  - font family (Inter), a type scale, a 4 px spacing base, radii and icon sizes
  - layout widths, such as the feed column width and the max content width
  - No MUI, Paper or Tailwind code in this package. The adapters live in each app,
    which keeps the package framework-agnostic as `type:util` requires.
- **Web setup**
  - The root layout wraps the app in `AppRouterCacheProvider` with
    `options={{ enableCssLayer: true }}`, then `ThemeProvider` with a theme built from
    the tokens (`createTheme({ cssVariables: true, ... })`). The theme lives in a single
    client module, and pages stay Server Components.
  - `global.css` is replaced: delete the Nx placeholder styles after confirming
    nothing references them, then add
    `@layer theme, base, mui, components, utilities; @import 'tailwindcss';`.
  - An `@theme inline` block maps Tailwind color names to MUI's generated CSS
    variables (`--color-primary: var(--mui-palette-primary-main)`, ...). Both
    libraries then read the same values at runtime.
  - Inter is loaded through `next/font/google` and wired into both MUI typography and
    Tailwind's `--font-sans`.
  - Tailwind's preflight is the only CSS reset. No `CssBaseline`, because two resets
    fight each other.
- **Web shell** (`(app)/layout.tsx`): a left navigation rail at the `md` breakpoint
  and wider, a bottom navigation bar below it, and a centered content column using the
  token widths. Nav items: Home, Search, Explore, Messages, Notifications (with an
  unread badge), Create, Profile, and Settings. The notifications entry keeps the
  accessible text `Notifications (N)`.
- **Web auth pages**: login and register become a centered card with outlined
  `TextField`s, a contained `Button` and an error `Alert`. Labels and button names stay
  exactly as they are.
- **Mobile setup**
  - The root `_layout.tsx` wraps the app in `PaperProvider`, with `MD3LightTheme`
    overridden from the tokens: colors, `roundness`, and fonts via `configureFonts`
    with Inter loaded through `expo-font`. `MaterialIcons` is set as Paper's icon
    provider.
  - NativeWind v4 setup: `tailwind.config.js` uses `nativewind/preset` and
    `theme.extend` built from the tokens. Also add `withNativeWind` in
    `metro.config.js`, merged with the existing SVG transformer config,
    `jsxImportSource: 'nativewind'` in the Babel preset, a `global.css`, and
    `nativewind-env.d.ts`.
  - **NativeWind v4 needs Tailwind v3, while web uses Tailwind v4.** Declare the
    Tailwind v3 version directly in `apps/mobile/package.json` (an exact version, not
    the usual `"*"`) and keep v4 in the root `package.json`. pnpm's isolated layout
    then gives each app its own copy. Verify with `pnpm --filter mobile why
tailwindcss`, the same check that caught the React version split.
  - Don't use Paper's `adaptNavigationTheme`. With SDK 56's
    `expo-router/react-navigation` imports it causes a type mismatch
    (callstack/react-native-paper#4967), and the published workaround is an `any`
    cast, which `CLAUDE.md` forbids. Pass token colors straight into Expo Router's
    `screenOptions` instead.
- **Mobile shell**: style the `(tabs)` tab bar from the tokens with `MaterialIcons`,
  keeping the existing tab labels.
- **Mobile auth screens**: outlined Paper `TextInput`s, a contained `Button` and an
  error `HelperText`. Keep every existing `accessibilityLabel`.
- **Tests**:
  - Unit tests for `design-tokens`, including a WCAG AA contrast check on every
    text/background pair the tokens define.
  - A shared mobile test render helper that wraps components in `PaperProvider`.
  - Configure Jest for NativeWind (`jest-expo` + the NativeWind Babel setup).
  - Every existing unit and e2e test passes with its selectors unchanged.
  - A new Playwright smoke test checks that the shell navigation renders at both a
    desktop and a phone viewport width.
  - Manual side-by-side check: `web:dev` at phone width next to Expo Go on the Android
    emulator, with screenshots noted in `docs/PROGRESS.md`.

### M24 — Feed, Posts & Profiles

- **Screens**:
  - Home feed: the post card gets an avatar + username header, the media carousel with
    page dots, a like/comment/save icon row, the like count, caption, comments link and
    timestamp.
  - Post detail with its comment thread, and the likers list.
  - Create post: picked-image grid, caption field, upload progress.
  - Profile: header with avatar, stats and follow button, plus a 3-column square post
    grid.
  - Edit profile, and the followers/following lists.
- **Web**: MUI `Avatar`, `IconButton`, `Button`, `TextField`, `LinearProgress` and
  `List`/`ListItem`, with Tailwind for the post grid and page layout.
- **Mobile**: Paper `Avatar.Image`, `IconButton`, `Button`, `TextInput`, `ProgressBar`
  and `List.Item`, with NativeWind for layout. The profile grid is a 3-column
  `FlatList`.
- **Icon toggles**: like is `FavoriteBorder`/`Favorite` in the token like-red, and save
  is `BookmarkBorder`/`Bookmark`. Each keeps its existing accessible name (`Like`/
  `Unlike`, `Save`/`Unsave`, `Follow`/`Unfollow`, `Share`) and exposes its pressed
  state (`aria-pressed` / `accessibilityState.selected`).
- **Loading, empty and error states**, the same on both platforms: MUI `Skeleton` on
  web, and a token-colored placeholder `View` on mobile (Paper has no skeleton). Empty
  states get an icon plus a sentence. Errors keep their current text.
- **Tests**: existing e2e and unit tests pass unchanged. Add component tests that the
  like and save toggles render the correct icon and pressed state for each value.

### M25 — Discovery, Activity, Messages & Settings

- **Screens**:
  - Explore: grid matching the profile grid.
  - Search: debounced field plus a results list.
  - Notifications: avatar + text + post thumbnail rows, with unread rows highlighted.
  - Saved posts: grid.
  - Messages inbox: one row per conversation with an unread-count `Badge`.
  - Conversation thread: chat bubbles, your own on the right in the primary color and
    the other person's on the left in the surface color, with an input bar fixed to
    the bottom.
  - Settings: sectioned list, change-password and change-email forms, and a
    delete-account confirmation in a MUI `Dialog` on web and a Paper `Portal` +
    `Dialog` on mobile.
- Same component parity, accessible-name and state-handling rules as M24.
- **Tests**: existing e2e and unit tests pass unchanged. Add component tests for the
  unread styling in the notifications list and the inbox, and for the bubble
  alignment of your own messages vs. the other person's.

### M26 — Cross-Platform Consistency & Polish Pass

- **Parity review**: compare every screen at a 390 px web viewport against the same
  screen in Expo Go on Android, using a checklist (spacing, type sizes, colors, icon
  choice, empty/loading/error states). Fix any drift and record the checklist
  outcome in `docs/PROGRESS.md`.
- **Enforce tokens**: remove leftover `StyleSheet` values and inline styles that
  duplicate tokens. Add a lint rule (`no-restricted-syntax`) that bans hex/rgb color
  literals in `apps/web` and `apps/mobile` source, so colors can only come from
  `design-tokens`. This waits until now because it would fail lint partway through
  the track.
- **Accessibility**: visible focus rings on web, touch targets of at least 48 dp on
  mobile, and contrast already covered by the M23 token tests. Whether to add an
  automated axe pass to Playwright is decided here, because it means a new
  dependency.
- **Visual regression baselines** (Playwright `toHaveScreenshot`, Chromium, a handful
  of key pages): optional, and adopted only if they stay stable. Baselines must be
  generated on Linux (CI's OS), not locally on Windows, because font rendering
  differs between them.
- **Fix `ARCHITECTURE.md` risk #11** (the `useActionState` + `redirect()` resubmit
  bug) in the four affected forms, which this track has just restyled. That risk
  entry already names UI-polish scope as its natural home. Remove
  `critical-path.spec.ts`'s `page.reload()` workaround only once a real resubmission
  is shown to redirect correctly without it.

### M27 — Push Notifications

The milestone previously recommended as M23. Its scoping notes (provider per platform,
device/subscription table, retrofit `NotificationsProcessor`, online vs. offline
delivery, tests) are unchanged; see `docs/PROGRESS.md`'s Next Milestone section.

## Summary Table

| #   | Milestone                    | New tables                                           | New packages/apps touched first |
| --- | ---------------------------- | ---------------------------------------------------- | ------------------------------- |
| 0   | Workspace bootstrap          | —                                                    | `eslint-config`                 |
| 1   | Docker infra                 | —                                                    | —                               |
| 2   | Prisma base                  | `User`, `RefreshToken`                               | `prisma`                        |
| 3   | Shared types/validation base | —                                                    | `types`, `validation`, `config` |
| 4   | API bootstrap                | —                                                    | `api`                           |
| 5   | Auth                         | —                                                    | —                               |
| 6   | Web bootstrap + auth UI      | —                                                    | `web`, `api-client`, `web-e2e`  |
| 7   | Mobile bootstrap + auth UI   | —                                                    | `mobile`                        |
| 8   | Profiles (read/edit)         | —                                                    | —                               |
| 9   | Media pipeline               | `Media`                                              | —                               |
| 10  | Follow/unfollow              | `Follow`                                             | —                               |
| 11  | Posts                        | `Post`, `PostMedia`                                  | —                               |
| 12  | Home feed                    | —                                                    | —                               |
| 13  | Likes                        | `Like`                                               | —                               |
| 14  | Comments                     | `Comment`                                            | —                               |
| 15  | Saved posts                  | `SavedPost`                                          | —                               |
| 16  | Notifications                | `Notification`                                       | —                               |
| 17  | User search                  | —                                                    | —                               |
| 18  | Explore page                 | —                                                    | —                               |
| 19  | Account settings             | —                                                    | —                               |
| 20  | E2E coverage + hardening     | —                                                    | —                               |
| 21  | Direct messages (foundation) | `Conversation`, `ConversationParticipant`, `Message` | —                               |
| 22  | Realtime transport (SSE)     | —                                                    | —                               |
| 23  | Design system + shells/auth  | —                                                    | `design-tokens`                 |
| 24  | Styling: feed/posts/profiles | —                                                    | —                               |
| 25  | Styling: discovery/activity  | —                                                    | —                               |
| 26  | Consistency + polish pass    | —                                                    | —                               |
| 27  | Push notifications           | Device/subscription table (decided in M27)           | —                               |
