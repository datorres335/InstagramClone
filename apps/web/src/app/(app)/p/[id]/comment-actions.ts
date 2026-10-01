'use server';

import type {
  CommentListResponse,
  CommentResponse,
  CreateCommentInput,
} from '@instagram-clone/validation';

import { getApiClient } from '../../../../lib/get-api-client';

export async function createCommentAction(
  postId: string,
  input: CreateCommentInput,
): Promise<CommentResponse> {
  return getApiClient().comments.create(postId, input);
}

export async function deleteCommentAction(
  postId: string,
  commentId: string,
): Promise<void> {
  await getApiClient().comments.remove(postId, commentId);
}

export async function getCommentsPageAction(
  postId: string,
  cursor: string | undefined,
): Promise<CommentListResponse> {
  return getApiClient().comments.list(postId, { cursor });
}
