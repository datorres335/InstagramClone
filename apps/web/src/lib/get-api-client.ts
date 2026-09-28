import { createApiClient, type ApiClient } from '@instagram-clone/api-client';

import { env } from './env';
import { createWebTokenStorage } from './web-token-storage';

/**
 * Built fresh per call (never module-level) — `cookies()` is only valid
 * within the current request's scope, so the client (and the storage
 * adapter closing over it) can't be constructed once and reused.
 */
export function getApiClient(): ApiClient {
  return createApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    storage: createWebTokenStorage(),
  });
}
