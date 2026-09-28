import { createApiClient } from '@instagram-clone/api-client';

import { env } from './env';
import { createMobileTokenStorage } from './mobile-token-storage';

/**
 * Unlike `apps/web` (which must build a fresh client per request — Next's
 * `cookies()` is only valid within a request scope), mobile has no such
 * constraint: `expo-secure-store` reads/writes work the same regardless of
 * when they're called, so one client built at module load covers the whole
 * app lifetime (docs/ARCHITECTURE.md §5.3).
 */
export const apiClient = createApiClient({
  baseUrl: env.EXPO_PUBLIC_API_URL,
  storage: createMobileTokenStorage(),
});
