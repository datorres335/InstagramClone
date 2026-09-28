import { NextResponse, type NextRequest } from 'next/server';

import {
  SESSION_COOKIE_NAME,
  parseSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
} from './lib/session-cookie';

/**
 * Keeps the session cookie's access token from going stale between page
 * loads. `next/headers`'s `cookies()` can only be *written* from a Server
 * Action or Route Handler — a plain Server Component render (e.g. `/home`
 * checking `apiClient.auth.session()`) can only read it. Without this,
 * a session older than the 15-minute access-token TTL would force a
 * refresh on every render that can never actually persist the newly
 * rotated refresh token back to the cookie, and the next request would
 * then present a refresh token the API has already rotated away — tripping
 * reuse-detection (docs/ARCHITECTURE.md §7) and wrongly logging a real user
 * out. This (Next 16's renamed successor to `middleware.ts`) runs ahead of
 * the render, on the response it's allowed to mutate, so it's the one
 * place this can be done correctly.
 *
 * Only refreshes when the cached access token is actually expired — not on
 * every request — so concurrent requests in the common case never race each
 * other into a rotation (rotating on every request would; see the
 * Milestone 6 deviation in docs/PROGRESS.md for the full reasoning).
 */
export async function proxy(request: NextRequest) {
  const stored = parseSessionCookie(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!stored) return NextResponse.next();

  const isExpired =
    !stored.accessTokenExpiresAt ||
    new Date(stored.accessTokenExpiresAt).getTime() <= Date.now();
  if (!isExpired) return NextResponse.next();

  const apiBaseUrl = process.env['NEXT_PUBLIC_API_URL'];
  if (!apiBaseUrl) return NextResponse.next();

  try {
    const res = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });

    const response = NextResponse.next();
    if (!res.ok) {
      // Refresh token invalid/expired/reused — drop the stale session and
      // let the destination page's own auth check redirect to /login.
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    const refreshed = (await res.json()) as {
      accessToken: string;
      accessTokenExpiresAt: string;
      refreshToken?: string;
    };
    response.cookies.set(
      SESSION_COOKIE_NAME,
      serializeSessionCookie({
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        refreshToken: refreshed.refreshToken ?? stored.refreshToken,
      }),
      sessionCookieOptions(),
    );
    return response;
  } catch {
    // Network hiccup talking to the API — don't destroy the session over
    // it, just let this request proceed with the (soon-to-be-refreshed-
    // again-next-time) token it already has.
    return NextResponse.next();
  }
}

export const config = {
  // Only routes that actually need a session pay for this — matches the
  // `(app)` route group's contents (docs/ARCHITECTURE.md §5.1).
  matcher: ['/home'],
};
