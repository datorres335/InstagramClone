# Project Instructions

## Project

This repository contains an Instagram-style social media application.

Architecture:

- Nx monorepo
- pnpm
- TypeScript
- Next.js 16
- NestJS
- Expo
- Prisma 7
- PostgreSQL

Applications:

- apps/web
- apps/api
- apps/mobile

Shared libraries live under packages/.

---

## General Rules

Always inspect the existing implementation before making changes.

Never assume an API exists without verifying it in the codebase.

Do not introduce another framework or library if the existing stack already
solves the problem adequately.

Avoid over-engineering.

Implement the simplest maintainable solution that satisfies the current
requirements.

Do not implement future features unless explicitly requested in the current
milestone.

Use strict TypeScript.

Avoid `any`.

Do not duplicate types unnecessarily.

Shared types should live in the appropriate shared package when they are
genuinely used by multiple applications.

---

## Package Management

Use pnpm exclusively.

Never use:

- npm install
- yarn
- bun

Use:

pnpm add
pnpm add -D
pnpm install

For Expo packages use:

pnpm exec expo install

when Expo requires version-compatible package installation.

---

## Backend

NestJS is the authoritative backend.

The frontend and mobile application must never access PostgreSQL directly.

All application data must go through the NestJS API.

Controllers should remain thin.

Business logic belongs in services.

Database access should be isolated behind appropriately designed services.

Validate external input.

Use DTOs for NestJS request boundaries.

Use Prisma 7 APIs only.

Never use deprecated Prisma APIs from older tutorials.

---

## Database

PostgreSQL is the primary database.

Prisma migrations are the authoritative database migration mechanism.

Never manually modify a migration that has already been applied unless the
project is explicitly resetting development history.

Use proper indexes and unique constraints.

Avoid N+1 queries.

Feed queries must use cursor-based pagination.

---

## Authentication

Passwords must never be stored directly.

Use a modern password hashing algorithm.

Access tokens must be short lived.

Refresh tokens must be revocable and rotated.

Authorization checks must be performed server-side.

Never trust authorization state supplied by a client.

---

## Web

Use Next.js App Router.

Prefer Server Components unless interactivity requires a Client Component.

Do not add `"use client"` unnecessarily.

Keep client-side state local unless shared state is genuinely required.

---

## Mobile

Use Expo Router.

Use Expo-compatible libraries.

Do not install native dependencies without checking Expo compatibility first.

Follow the Expo SDK documentation matching the installed SDK.

---

## API

REST endpoints should follow consistent conventions.

Use cursor pagination for feeds and large collections.

Return predictable error structures.

Keep API contracts synchronized with the shared API client.

---

## Testing

Every major feature must have appropriate tests.

Before considering a milestone complete:

1. Typecheck
2. Lint
3. Run relevant unit tests
4. Run relevant integration tests
5. Run relevant E2E tests when applicable
6. Build affected applications

Never delete or weaken tests simply to make them pass.

Never hard-code behavior specifically to satisfy a test.

---

## Git

Work incrementally.

Each milestone should leave the repository in a working state.

Before beginning a milestone:

- inspect current repository state
- read docs/IMPLEMENTATION_PLAN.md
- read docs/PROGRESS.md

After completing a milestone:

- run validation
- update docs/PROGRESS.md

Do not force push.

Do not rewrite Git history.

---

## Documentation

Keep these files synchronized with the implementation:

- docs/ARCHITECTURE.md
- docs/API.md
- docs/DATABASE.md
- docs/FEATURES.md
- docs/PROGRESS.md

Documentation should describe the system that actually exists, not an
imaginary future implementation.

---

## Autonomous Work

When completing a milestone:

1. Inspect the relevant existing code.
2. Determine the smallest correct implementation.
3. Implement it.
4. Run tests.
5. Fix failures.
6. Re-run tests.
7. Update documentation.
8. Report what changed.

Do not stop simply because the first implementation fails.

Investigate and correct reasonable implementation errors autonomously.

If a decision would be destructive, irreversible, expensive, or requires
credentials/secrets, stop and ask for approval.
