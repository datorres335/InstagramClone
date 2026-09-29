import type { RefreshResponse } from '@instagram-clone/validation';

import {
  ApiError,
  NotAuthenticatedError,
  type ProblemDetails,
} from './api-error';
import type { StoredTokens, TokenStorage } from './token-storage';

// A token is treated as expired slightly before its real expiry so a
// request never races a same-instant server-side expiry.
const EXPIRY_SKEW_MS = 5_000;

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - EXPIRY_SKEW_MS <= Date.now();
}

export interface HttpClientConfig {
  baseUrl: string;
  storage: TokenStorage;
}

async function parseErrorBody(res: Response): Promise<ProblemDetails> {
  try {
    return (await res.json()) as ProblemDetails;
  } catch {
    return { type: 'about:blank', title: res.statusText, status: res.status };
  }
}

/**
 * The one hand-written transport layer (docs/ARCHITECTURE.md §6.2) both
 * `web` and `mobile` share: a `fetch` wrapper, an auth-refresh interceptor
 * (mint/refresh the access token, retry once on a stale one), and Problem
 * Details error unwrapping. Endpoint-specific methods (see `auth-client.ts`)
 * are built on top of `request`/`authorizedRequest`, not duplicated here.
 */
export class HttpClient {
  readonly storage: TokenStorage;
  private readonly baseUrl: string;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.storage = config.storage;
  }

  /** Unauthenticated call — register/login/refresh/logout don't need a token. */
  request<TResponse, TBody = undefined>(
    method: string,
    path: string,
    body?: TBody,
  ): Promise<TResponse> {
    return this.send<TResponse, TBody>(method, path, { body });
  }

  /**
   * Authenticated call: attaches a valid access token (refreshing first if
   * the stored one is missing/expired) and retries once, after a fresh
   * refresh, if the server still rejects it as unauthorized.
   */
  async authorizedRequest<TResponse, TBody = undefined>(
    method: string,
    path: string,
    body?: TBody,
  ): Promise<TResponse> {
    const accessToken = await this.ensureAccessToken();
    try {
      return await this.send<TResponse, TBody>(method, path, {
        body,
        accessToken,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.problem.status !== 401)
        throw error;
      const refreshedToken = await this.refresh();
      return this.send<TResponse, TBody>(method, path, {
        body,
        accessToken: refreshedToken,
      });
    }
  }

  /**
   * For routes that behave differently when authenticated but don't require
   * it (`GET /users/:username`, docs/API.md §4 — mirrors the API's own
   * `OptionalAuthGuard`): attaches a valid access token if a session exists,
   * proceeds without one otherwise. Never throws `NotAuthenticatedError`.
   * No retry-on-401 (unlike `authorizedRequest`) — an optionally-authed
   * route never rejects for auth reasons, so a 401 here would mean
   * something else is wrong and should surface as-is.
   */
  async optionallyAuthorizedRequest<TResponse, TBody = undefined>(
    method: string,
    path: string,
    body?: TBody,
  ): Promise<TResponse> {
    let accessToken: string | undefined;
    try {
      accessToken = await this.ensureAccessToken();
    } catch (error) {
      if (!(error instanceof NotAuthenticatedError)) throw error;
    }
    return this.send<TResponse, TBody>(method, path, { body, accessToken });
  }

  /** Mints a fresh access token from the stored refresh token and persists the result. */
  async refresh(): Promise<string> {
    const stored = await this.storage.read();
    if (!stored) throw new NotAuthenticatedError();

    const response = await this.request<
      RefreshResponse,
      { refreshToken: string }
    >('POST', '/auth/refresh', {
      refreshToken: stored.refreshToken,
    });
    const tokens: StoredTokens = {
      accessToken: response.accessToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      // The API always returns a rotated refresh token (docs/API.md §3), but
      // fall back to the one we already have rather than crash if it didn't.
      refreshToken: response.refreshToken ?? stored.refreshToken,
    };
    await this.storage.write(tokens);
    return tokens.accessToken as string;
  }

  private async ensureAccessToken(): Promise<string> {
    const stored = await this.storage.read();
    if (!stored) throw new NotAuthenticatedError();
    if (stored.accessToken && !isExpired(stored.accessTokenExpiresAt)) {
      return stored.accessToken;
    }
    return this.refresh();
  }

  private async send<TResponse, TBody>(
    method: string,
    path: string,
    options: { body?: TBody; accessToken?: string },
  ): Promise<TResponse> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json';
    if (options.accessToken)
      headers['Authorization'] = `Bearer ${options.accessToken}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) throw new ApiError(await parseErrorBody(res));
    if (res.status === 204) return undefined as TResponse;
    return (await res.json()) as TResponse;
  }
}
