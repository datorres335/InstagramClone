import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getApiClient } from '../../../lib/get-api-client';
import { FeedList } from './feed-list';

export const metadata = {
  title: 'Home',
};

/**
 * The authenticated home feed (docs/API.md §7, docs/FEATURES.md #10,
 * Milestone 12): posts from followed accounts, newest first, never the
 * viewer's own posts. Navigation, the notification badge and logout live in
 * the app shell (`(app)/layout.tsx`, Milestone 23).
 */
export default async function HomePage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const feed = await apiClient.posts.getFeed();

  return (
    <main className="mx-auto w-full max-w-feed">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-headline font-semibold">
          Welcome, {user.username}
        </h1>
        <Link
          href={`/${user.username}`}
          className="text-label font-semibold text-primary hover:underline"
        >
          View profile
        </Link>
      </header>
      <FeedList
        initialPosts={feed.data}
        initialNextCursor={feed.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
