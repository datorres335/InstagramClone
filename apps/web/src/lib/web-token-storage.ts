import { cookies } from 'next/headers';

import type { StoredTokens, TokenStorage } from '@instagram-clone/api-client';

import {
  SESSION_COOKIE_NAME,
  parseSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
} from './session-cookie';

/**
 * `TokenStorage` backed by Next's `cookies()` (docs/ARCHITECTURE.md §7, risk
 * #5's storage-adapter interface — this is the web half; `expo-secure-store`
 * lands in Milestone 7). `write`/`clear` only work when called from a
 * Server Action or Route Handler; calling them from a plain render throws
 * (Next's own restriction), so those code paths only ever run from actions
 * (`register`/`login`/`logout`) — see `middleware.ts` for how a page render
 * still ends up with a fresh access token without needing to write one.
 */
export function createWebTokenStorage(): TokenStorage {
  return {
    async read() {
      const store = await cookies();
      return parseSessionCookie(store.get(SESSION_COOKIE_NAME)?.value);
    },

    async write(tokens: StoredTokens) {
      const store = await cookies();
      store.set(
        SESSION_COOKIE_NAME,
        serializeSessionCookie(tokens),
        sessionCookieOptions(),
      );
    },

    async clear() {
      const store = await cookies();
      store.delete(SESSION_COOKIE_NAME);
    },
  };
}
