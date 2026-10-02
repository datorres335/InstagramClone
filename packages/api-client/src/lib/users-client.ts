import type {
  ChangeEmailInput,
  ChangePasswordInput,
  DeleteAccountInput,
  MediaResponse,
  PaginationQuery,
  PublicProfileResponse,
  RefreshResponse,
  UpdateProfileInput,
  UserPostsResponse,
  UserResponse,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';
import type { StoredTokens } from './token-storage';

export interface UsersClient {
  getProfile(username: string): Promise<PublicProfileResponse>;
  /** The profile grid, paginated (docs/API.md §4). */
  getPosts(
    username: string,
    query?: PaginationQuery,
  ): Promise<UserPostsResponse>;
  updateProfile(input: UpdateProfileInput): Promise<UserResponse>;
  /** `PATCH /me/avatar` (docs/API.md §4) — `mediaId` must be the caller's own `READY` `AVATAR` media. */
  updateAvatar(mediaId: string): Promise<MediaResponse>;
  /**
   * `POST /me/change-password` (docs/API.md §13) — invalidates every other
   * session; persists the fresh token pair the response carries so the
   * *calling* session keeps working without a re-login.
   */
  changePassword(input: ChangePasswordInput): Promise<void>;
  /** `POST /me/change-email` (docs/API.md §13) — returns the updated user. */
  changeEmail(input: ChangeEmailInput): Promise<UserResponse>;
  /**
   * `DELETE /me` (docs/API.md §4/§13) — soft-deletes the account and
   * revokes every session server-side; clears the locally stored session
   * too, the same "always clear locally" guarantee `AuthClient.logout`
   * already gives, since there's no account left to be logged into.
   */
  deleteAccount(input: DeleteAccountInput): Promise<void>;
}

export function createUsersClient(http: HttpClient): UsersClient {
  return {
    getProfile(username) {
      return http.optionallyAuthorizedRequest<PublicProfileResponse>(
        'GET',
        `/users/${encodeURIComponent(username)}`,
      );
    },

    getPosts(username, query) {
      return http.optionallyAuthorizedRequest<UserPostsResponse>(
        'GET',
        `/users/${encodeURIComponent(username)}/posts${buildQueryString(query)}`,
      );
    },

    updateProfile(input) {
      return http.authorizedRequest<UserResponse, UpdateProfileInput>(
        'PATCH',
        '/me',
        input,
      );
    },

    updateAvatar(mediaId) {
      return http.authorizedRequest<MediaResponse, { mediaId: string }>(
        'PATCH',
        '/me/avatar',
        { mediaId },
      );
    },

    async changePassword(input) {
      const response = await http.authorizedRequest<
        RefreshResponse,
        ChangePasswordInput
      >('POST', '/me/change-password', input);
      if (!response.refreshToken) {
        // Should never happen — the API always includes it (mirrors
        // auth-client.ts's persistSession guard for the same reason).
        throw new Error(
          'Change-password response did not include a refreshToken; cannot persist the new session.',
        );
      }
      const tokens: StoredTokens = {
        accessToken: response.accessToken,
        accessTokenExpiresAt: response.accessTokenExpiresAt,
        refreshToken: response.refreshToken,
      };
      await http.storage.write(tokens);
    },

    changeEmail(input) {
      return http.authorizedRequest<UserResponse, ChangeEmailInput>(
        'POST',
        '/me/change-email',
        input,
      );
    },

    async deleteAccount(input) {
      await http.authorizedRequest<void, DeleteAccountInput>(
        'DELETE',
        '/me',
        input,
      );
      await http.storage.clear();
    },
  };
}
