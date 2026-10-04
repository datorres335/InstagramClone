import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { MessageThread } from './message-thread';

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The conversation thread view (docs/API.md §17, docs/IMPLEMENTATION_PLAN.md
 * M21). A `403`/`404` from the membership check both render as a plain
 * `notFound()` — the same "don't let a URL distinguish 'doesn't exist' from
 * 'not yours' for someone else's resource" posture, mirroring `PostPage`'s
 * own `404` handling.
 */
export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { id } = await params;
  const apiClient = getApiClient();

  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  let conversation;
  try {
    conversation = await apiClient.conversations.get(id);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.problem.status === 404 || error.problem.status === 403)
    ) {
      notFound();
    }
    throw error;
  }

  const messages = await apiClient.conversations.listMessages(id);
  const other = conversation.otherParticipants[0];

  return (
    <main>
      <h1>@{other?.username ?? 'unknown'}</h1>
      <Link href="/messages">Back to messages</Link>
      <MessageThread
        conversationId={id}
        initialMessages={messages.data}
        initialNextCursor={messages.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
