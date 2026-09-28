import type {
  AuthResponse,
  LoginInput,
  LogoutInput,
  RegisterInput,
  SessionResponse,
  UserResponse,
} from '@instagram-clone/validation';

import { ApiError, NotAuthenticatedError } from './api-error';
import type { HttpClient } from './http-client';
import type { StoredTokens } from './token-storage';

export interface AuthClient {
  register(input: RegisterInput): Promise<UserResponse>;
  login(input: LoginInput): Promise<UserResponse>;
  logout(options?: { allDevices?: boolean }): Promise<void>;
  /** `null` if there's no session, rather than throwing — matches docs/API.md §3's "cheap who-am-I check". */
  session(): Promise<UserResponse | null>;
}

async function persistSession(
  http: HttpClient,
  response: AuthResponse,
): Promise<void> {
  if (!response.refreshToken) {
    // Should never happen — the API always includes it (docs/API.md §3
    // footnote, the Milestone 5 deviation) — but guard rather than silently
    // drop the session if that ever stops being true.
    throw new Error(
      'Auth response did not include a refreshToken; cannot persist a session.',
    );
  }
  const tokens: StoredTokens = {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshToken: response.refreshToken,
  };
  await http.storage.write(tokens);
}

export function createAuthClient(http: HttpClient): AuthClient {
  return {
    async register(input) {
      const response = await http.request<AuthResponse, RegisterInput>(
        'POST',
        '/auth/register',
        input,
      );
      await persistSession(http, response);
      return response.user;
    },

    async login(input) {
      const response = await http.request<AuthResponse, LoginInput>(
        'POST',
        '/auth/login',
        input,
      );
      await persistSession(http, response);
      return response.user;
    },

    async logout(options = {}) {
      const stored = await http.storage.read();
      try {
        if (stored?.refreshToken) {
          await http.request<void, LogoutInput>('POST', '/auth/logout', {
            refreshToken: stored.refreshToken,
            allDevices: options.allDevices,
          });
        }
      } finally {
        // Always clear locally, even if the network call failed — a logout
        // the user asked for should never leave them looking still logged in.
        await http.storage.clear();
      }
    },

    async session() {
      try {
        const response = await http.authorizedRequest<SessionResponse>(
          'GET',
          '/auth/session',
        );
        return response.user;
      } catch (error) {
        if (error instanceof NotAuthenticatedError) return null;
        if (error instanceof ApiError && error.problem.status === 401)
          return null;
        throw error;
      }
    },
  };
}
