# Instagram Clone

A production-quality Instagram-style application. Nx monorepo, pnpm workspaces,
TypeScript throughout. See [`docs/`](docs/) for the full design:
[`ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`DATABASE.md`](docs/DATABASE.md),
[`API.md`](docs/API.md), [`FEATURES.md`](docs/FEATURES.md), and the milestone
sequence in [`IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Prerequisites

- Node.js 22+
- pnpm (managed via [Corepack](https://nodejs.org/api/corepack.html); this repo pins
  the exact version in `package.json#packageManager`)
- Docker (for local Postgres/Redis/MinIO/Maildev)

## Getting Started

```bash
# 1. Install dependencies (pnpm only — never npm/yarn/bun, see CLAUDE.md)
corepack enable
pnpm install

# 2. Copy env vars and adjust if needed
cp .env.example .env

# 3. Start local infrastructure (Postgres, Redis, MinIO, Maildev)
docker compose up -d

# 4. Generate the Prisma client (no models yet at this milestone)
pnpm exec nx run prisma:generate

# 5. Run apps
pnpm exec nx run web:dev        # Next.js dev server
pnpm exec nx run api:serve      # NestJS dev server
cd apps/mobile && pnpm exec expo start   # Expo dev server
```

> **Why not `pnpm exec nx run mobile:start`?** On Windows, Nx cannot show Expo's
> interactive CLI menu (the `i`/`a`/`w` shortcuts) — this is a confirmed upstream Nx
> limitation (pseudo-terminal support is disabled by default on Windows), not
> something fixable in this repo's config. Run Expo directly instead, as shown
> above. See `docs/PROGRESS.md`'s Known Issues for the full investigation.

## Common Commands

```bash
pnpm exec nx graph                                   # visualize the project graph
pnpm exec nx run-many -t lint test build              # run a target across all projects
pnpm exec nx affected -t lint test build               # run a target across only affected projects
pnpm exec nx run <project>:<target>                    # run one target on one project
```

## Repository Layout

```
apps/
  web/          Next.js 16 (App Router)
  api/          NestJS
  mobile/       Expo (Expo Router)
  web-e2e/      Playwright tests for apps/web
packages/
  types/        Shared, framework-agnostic TypeScript types
  validation/   Shared Zod schemas (single source of truth for request/response shapes)
  api-client/   Typed REST client consumed by web + mobile
  config/       Env schema + typed config loader (zod-validated)
  eslint-config/ Shared ESLint + Prettier configuration
prisma/         Prisma schema, migrations, seed script (shared by apps/api)
docs/           Architecture, database, API, features, and implementation plan
```

## Package Management

This repository uses **pnpm exclusively**. Do not use `npm install`, `yarn`, or `bun`.
For Expo packages that need SDK-compatible versions, use `pnpm exec expo install <pkg>`
from `apps/mobile` rather than `pnpm add`.

## Status

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for what has been implemented so far against
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
