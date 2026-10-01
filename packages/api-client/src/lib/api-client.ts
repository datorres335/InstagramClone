import { type AuthClient, createAuthClient } from './auth-client';
import { createCommentsClient, type CommentsClient } from './comments-client';
import { createFollowsClient, type FollowsClient } from './follows-client';
import { HttpClient, type HttpClientConfig } from './http-client';
import { createLikesClient, type LikesClient } from './likes-client';
import { createMediaClient, type MediaClient } from './media-client';
import {
  createNotificationsClient,
  type NotificationsClient,
} from './notifications-client';
import { createPostsClient, type PostsClient } from './posts-client';
import {
  createSavedPostsClient,
  type SavedPostsClient,
} from './saved-posts-client';
import { createSearchClient, type SearchClient } from './search-client';
import { createUsersClient, type UsersClient } from './users-client';

export interface ApiClient {
  auth: AuthClient;
  users: UsersClient;
  media: MediaClient;
  follows: FollowsClient;
  posts: PostsClient;
  likes: LikesClient;
  comments: CommentsClient;
  savedPosts: SavedPostsClient;
  notifications: NotificationsClient;
  search: SearchClient;
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
    likes: createLikesClient(http),
    comments: createCommentsClient(http),
    savedPosts: createSavedPostsClient(http),
    notifications: createNotificationsClient(http),
    search: createSearchClient(http),
  };
}
