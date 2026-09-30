import type {
  CreatePostInput,
  PostResponse,
} from '@instagram-clone/validation';

import type { HttpClient } from './http-client';

export interface PostsClient {
  /** `POST /posts` (docs/API.md §7) — `mediaIds` must be the caller's own `READY`, `POST_IMAGE`-purpose media. */
  create(input: CreatePostInput): Promise<PostResponse>;
  getById(postId: string): Promise<PostResponse>;
  /** `DELETE /posts/:id` (docs/API.md §7) — author-only. */
  remove(postId: string): Promise<void>;
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
  };
}
