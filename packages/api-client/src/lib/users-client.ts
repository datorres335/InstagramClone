import type {
  MediaResponse,
  PaginationQuery,
  PublicProfileResponse,
  UpdateProfileInput,
  UserPostsResponse,
  UserResponse,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

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
  };
}
