import { redirect } from 'next/navigation';

import { getApiClient } from '../../../lib/get-api-client';
import { ConversationsList } from './conversations-list';
import { StartConversationForm } from './start-conversation-form';

export const metadata = {
  title: 'Messages',
};

/** The inbox (docs/API.md §17, docs/IMPLEMENTATION_PLAN.md M21) — required auth, the same "my own" reasoning `GET /notifications` already established. */
export default async function MessagesPage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const conversations = await apiClient.conversations.list();

  return (
    <main className="mx-auto flex w-full max-w-feed flex-col gap-4">
      <h1 className="text-title font-semibold">Messages</h1>
      <StartConversationForm />
      <ConversationsList
        initialConversations={conversations.data}
        initialNextCursor={conversations.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
