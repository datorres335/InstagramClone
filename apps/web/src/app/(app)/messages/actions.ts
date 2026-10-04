'use server';

import type {
  ConversationListResponse,
  ConversationResponse,
  MessageListResponse,
  MessageResponse,
} from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

/** `GET /conversations` (docs/API.md §17, Milestone 21) — "load more"/poll backing for `ConversationsList`. */
export async function getConversationsPageAction(
  cursor: string | undefined,
): Promise<ConversationListResponse> {
  return getApiClient().conversations.list({ cursor });
}

/** `POST /conversations` (docs/API.md §17) — idempotent; returns the existing conversation if there is one. */
export async function startConversationAction(
  username: string,
): Promise<ConversationResponse> {
  return getApiClient().conversations.start(username);
}

/** `GET /conversations/:id/messages` (docs/API.md §17) — "load more"/poll backing for `MessageThread`. */
export async function getMessagesPageAction(
  conversationId: string,
  cursor: string | undefined,
): Promise<MessageListResponse> {
  return getApiClient().conversations.listMessages(conversationId, { cursor });
}

/** `POST /conversations/:id/messages` (docs/API.md §17). */
export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<MessageResponse> {
  return getApiClient().conversations.sendMessage(conversationId, body);
}
