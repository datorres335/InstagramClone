import type {
  MediaResponse,
  PaginationQuery,
  PublicProfileResponse,
  UpdateProfileInput,
  UserPostsResponse,
  UserResponse,
} from '@instagram-clone/validation';

import type { HttpClient } from './http-client';

export interface UsersClient {
  getProfile(username: string): Promise<PublicProfileResponse>;
  /** Always an empty page today — `Post` doesn't exist until Milestone 11 (docs/API.md §4). */
  getPosts(
    username: string,
    query?: PaginationQuery,
  ): Promise<UserPostsResponse>;
  updateProfile(input: UpdateProfileInput): Promise<UserResponse>;
  /** `PATCH /me/avatar` (docs/API.md §4) — `mediaId` must be the caller's own `READY` `AVATAR` media. */
  updateAvatar(mediaId: string): Promise<MediaResponse>;
}

function buildQueryString(query?: PaginationQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
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
