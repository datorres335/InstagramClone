import { loadEnv, webEnvSchema } from '@instagram-clone/config';

/**
 * Fail fast on a misconfigured environment, same philosophy as `apps/api`'s
 * `main.ts` (docs/ARCHITECTURE.md §6, `packages/config`).
 */
export const env = loadEnv(webEnvSchema);
