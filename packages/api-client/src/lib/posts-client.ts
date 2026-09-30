import type {
  CreatePostInput,
  FeedResponse,
  PaginationQuery,
  PostResponse,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface PostsClient {
  /** `POST /posts` (docs/API.md §7) — `mediaIds` must be the caller's own `READY`, `POST_IMAGE`-purpose media. */
  create(input: CreatePostInput): Promise<PostResponse>;
  getById(postId: string): Promise<PostResponse>;
  /** `DELETE /posts/:id` (docs/API.md §7) — author-only. */
  remove(postId: string): Promise<void>;
  /**
   * `GET /feed` (docs/API.md §7, Milestone 12) — posts from followed
   * accounts, newest first. `Partial`, not `PaginationQuery`, since callers
   * paginating via a "load more" affordance only ever have a `cursor` in
   * hand and should be able to omit `limit` to get the server's default
   * rather than needing to know/repeat it.
   */
  getFeed(query?: Partial<PaginationQuery>): Promise<FeedResponse>;
}

export function createPostsClient(http: HttpClient): PostsClient {
  return {
    create(input) {
      return http.authorizedRequest<PostResponse, CreatePostInput>(
        'POST',
        '/posts',
        input,
      );
    },

    getById(postId) {
      return http.optionallyAuthorizedRequest<PostResponse>(
        'GET',
        `/posts/${encodeURIComponent(postId)}`,
      );
    },

    remove(postId) {
      return http.authorizedRequest<void>(
        'DELETE',
        `/posts/${encodeURIComponent(postId)}`,
      );
    },

    getFeed(query) {
      return http.authorizedRequest<FeedResponse>(
        'GET',
        `/feed${buildQueryString(query)}`,
      );
    },
  };
}
