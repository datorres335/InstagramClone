import { type AuthClient, createAuthClient } from './auth-client';
import { createFollowsClient, type FollowsClient } from './follows-client';
import { HttpClient, type HttpClientConfig } from './http-client';
import { createMediaClient, type MediaClient } from './media-client';
import { createPostsClient, type PostsClient } from './posts-client';
import { createUsersClient, type UsersClient } from './users-client';

export interface ApiClient {
  auth: AuthClient;
  users: UsersClient;
  media: MediaClient;
  follows: FollowsClient;
  posts: PostsClient;
}

/**
 * Builds a typed REST client for the Instagram Clone API
 * (docs/ARCHITECTURE.md §6.2): one namespace per resource (only `auth`
 * exists so far — this grows as later milestones add posts/follows/etc.),
 * backed by one shared `HttpClient` transport.
 *
 * Constructed per-request in `apps/web` (Next's `cookies()` is only valid
 * within a request scope) and once at app startup in `apps/mobile`
 * (Milestone 7).
 */
export function createApiClient(config: HttpClientConfig): ApiClient {
  const http = new HttpClient(config);
  return {
    auth: createAuthClient(http),
    users: createUsersClient(http),
    media: createMediaClient(http),
    follows: createFollowsClient(http),
    posts: createPostsClient(http),
  };
}
