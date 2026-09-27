import type { AxiosResponse } from 'axios';

/**
 * Pulls one cookie's value out of a response's `Set-Cookie` header. Axios has
 * no cookie jar of its own, so e2e tests that need to carry the httpOnly
 * refresh-token cookie across requests read it out manually and pass it back
 * via a `Cookie` header on the next call.
 */
export function extractCookie(
  res: AxiosResponse,
  name: string,
): string | undefined {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return undefined;
  const header = (Array.isArray(setCookie) ? setCookie : [setCookie]).find(
    (entry) => entry.startsWith(`${name}=`),
  );
  if (!header) return undefined;
  return header.split(';')[0].slice(name.length + 1);
}
