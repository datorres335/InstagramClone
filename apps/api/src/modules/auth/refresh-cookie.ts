import type { CookieOptions, Request, Response } from 'express';
import ms from 'ms';

import type { ApiEnv } from '@instagram-clone/config';

/**
 * The httpOnly refresh-token cookie (docs/ARCHITECTURE.md §7). Scoped to
 * `/api/v1/auth` so it isn't attached to every API request, only auth ones.
 *
 * `secure: true` is skipped outside production because a `Secure` cookie is
 * silently dropped by browsers over plain `http://localhost`, which would
 * break local dev entirely — the standard, necessary trade-off for this
 * cookie to work at all before HTTPS is in front of the API.
 */
export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function cookieOptions(env: ApiEnv): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  res: Response,
  env: ApiEnv,
  token: string,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(env),
    maxAge: ms(env.REFRESH_TOKEN_TTL as ms.StringValue),
  });
}

export function clearRefreshCookie(res: Response, env: ApiEnv): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(env));
}

/** Mobile sends the token in the body; web only ever sends the cookie. */
export function extractRefreshToken(
  req: Request,
  bodyToken: string | undefined,
): string | undefined {
  return (
    bodyToken ??
    (req.cookies as Record<string, string | undefined> | undefined)?.[
      REFRESH_COOKIE_NAME
    ]
  );
}
