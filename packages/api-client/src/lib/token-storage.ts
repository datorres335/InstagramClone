/**
 * A session as `api-client` needs to see it. `accessToken`/
 * `accessTokenExpiresAt` are nullable so a storage adapter can deliberately
 * hold only a refresh token (see the web adapter in `apps/web` — Next's
 * `cookies()` can't be written outside a Server Action/Route Handler, so it
 * never persists an access token at all and lets `HttpClient` mint one fresh
 * every time it's needed instead).
 */
export interface StoredTokens {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string;
}

/**
 * Storage-adapter interface (docs/ARCHITECTURE.md §7, risk #5): where a
 * platform persists the current session differs by platform (web: an
 * httpOnly cookie; mobile: `expo-secure-store`, Milestone 7), but the
 * refresh/retry logic that reads and writes it is identical either way and
 * lives once, in `HttpClient`, instead of being duplicated per platform.
 */
export interface TokenStorage {
  read(): Promise<StoredTokens | null>;
  write(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}
