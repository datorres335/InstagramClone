import type { StoredTokens } from '@instagram-clone/api-client';

/**
 * The web session, as a single httpOnly cookie on `apps/web`'s own origin —
 * NOT the API's own refresh cookie (docs/API.md §3), which is scoped to the
 * API's origin/path and never reaches `apps/web`'s server directly. See
 * docs/ARCHITECTURE.md §5.1: the Next server calls the API the same way
 * `mobile` does (an explicit `refreshToken` in the request body — the API
 * always includes one in its responses specifically so this doesn't need a
 * client-type signal), then keeps its own session for the browser.
 *
 * Both tokens are stored together (not just the refresh token) so a plain
 * page render can reuse a still-valid access token without needing to
 * refresh — `next/headers`'s `cookies()` can only be *written* from a
 * Server Action or Route Handler, not a Server Component render or a plain
 * page load, so `proxy.ts` (Next 16's renamed `middleware.ts`) is what keeps
 * this cookie's access token from going stale between visits (see there for
 * why).
 */
export const SESSION_COOKIE_NAME = 'session';
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matching the API's own refresh-token TTL

export function parseSessionCookie(
  value: string | undefined,
): StoredTokens | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredTokens;
    if (typeof parsed.refreshToken !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeSessionCookie(tokens: StoredTokens): string {
  return JSON.stringify(tokens);
}

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
