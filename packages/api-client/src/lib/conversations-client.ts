import type {
  ConversationListResponse,
  ConversationResponse,
  MessageListResponse,
  MessageResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { buildQueryString } from './build-query-string';
import type { HttpClient } from './http-client';

export interface ConversationsClient {
  /** `POST /conversations` (docs/API.md §17, Milestone 21) — idempotent: returns the existing 1:1 conversation with `username` if there is one. */
  start(username: string): Promise<ConversationResponse>;
  /** `GET /conversations/:id` (docs/API.md §17) — a single conversation by id. */
  get(conversationId: string): Promise<ConversationResponse>;
  /**
   * `GET /conversations` (docs/API.md §17) — the caller's own conversations,
   * newest activity first. `Partial`, not `PaginationQuery`, matching
   * `NotificationsClient.list`'s reasoning: a "load more" affordance only
   * ever has a `cursor` in hand.
   */
  list(query?: Partial<PaginationQuery>): Promise<ConversationListResponse>;
  /** `GET /conversations/:id/messages` (docs/API.md §17) — oldest first. */
  listMessages(
    conversationId: string,
    query?: Partial<PaginationQuery>,
  ): Promise<MessageListResponse>;
  /** `POST /conversations/:id/messages` (docs/API.md §17). */
  sendMessage(conversationId: string, body: string): Promise<MessageResponse>;
}

export function createConversationsClient(
  http: HttpClient,
): ConversationsClient {
  return {
    start(username) {
      return http.authorizedRequest<ConversationResponse, { username: string }>(
        'POST',
        '/conversations',
        { username },
      );
    },

    get(conversationId) {
      return http.authorizedRequest<ConversationResponse>(
        'GET',
        `/conversations/${conversationId}`,
      );
    },

    list(query) {
      return http.authorizedRequest<ConversationListResponse>(
        'GET',
        `/conversations${buildQueryString(query)}`,
      );
    },

    listMessages(conversationId, query) {
      return http.authorizedRequest<MessageListResponse>(
        'GET',
        `/conversations/${conversationId}/messages${buildQueryString(query)}`,
      );
    },

    sendMessage(conversationId, body) {
      return http.authorizedRequest<MessageResponse, { body: string }>(
        'POST',
        `/conversations/${conversationId}/messages`,
        { body },
      );
    },
  };
}
