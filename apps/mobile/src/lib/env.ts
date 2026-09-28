import { loadEnv, mobileEnvSchema } from '@instagram-clone/config';

/**
 * Fail fast on a misconfigured environment, same philosophy as `apps/api`'s
 * `main.ts` and `apps/web`'s `lib/env.ts` (docs/ARCHITECTURE.md §6,
 * `packages/config`).
 *
 * `EXPO_PUBLIC_API_URL` must be referenced as its own literal
 * `process.env.EXPO_PUBLIC_...` expression, not via a spread/passthrough of
 * the whole `process.env` object — Expo's babel plugin statically replaces
 * exactly that expression at bundle time; a bundled app's real `process.env`
 * has no actual env vars in it, so passing the object through generically
 * (as `apps/web`'s equivalent does, since Next.js works differently) would
 * silently fail on-device despite appearing to work under Jest/Node.
 */
export const env = loadEnv(mobileEnvSchema, {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
