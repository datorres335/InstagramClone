import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { ApiError } from '@instagram-clone/api-client';

import { UserAvatar } from '../../../../components/ui/user-avatar';
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
 *
 * Fills the viewport below the shell (its 14-unit phone top and bottom bars
 * and the content column's 6-unit vertical padding), so a short thread still
 * has its input bar at the bottom of the screen.
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
    <main className="mx-auto flex min-h-[calc(100dvh-(--spacing(40)))] w-full max-w-feed flex-col md:min-h-[calc(100dvh-(--spacing(12)))]">
      <header className="sticky top-14 z-1 flex items-center gap-2 border-b border-border bg-background pb-2 md:top-0">
        {/* Not "Back to messages": e2e finds the message field by the label "Message". */}
        <Link
          href="/messages"
          aria-label="Back to inbox"
          className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-surface"
        >
          <ArrowBackIcon />
        </Link>
        <UserAvatar
          username={other?.username ?? '?'}
          avatarUrl={other?.avatarUrl ?? null}
          size="sm"
        />
        <div className="min-w-0">
          <h1 className="truncate text-label font-semibold">
            {other ? (
              <Link href={`/${other.username}`} className="hover:underline">
                @{other.username}
              </Link>
            ) : (
              '@unknown'
            )}
          </h1>
          {other?.fullName && (
            <p className="truncate text-caption text-text-secondary">
              {other.fullName}
            </p>
          )}
        </div>
      </header>
      <MessageThread
        conversationId={id}
        initialMessages={messages.data}
        initialNextCursor={messages.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
