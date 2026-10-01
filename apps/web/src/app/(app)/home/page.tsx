import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getApiClient } from '../../../lib/get-api-client';
import { NotificationBadge } from '../notification-badge';
import { logoutAction } from './actions';
import { FeedList } from './feed-list';

export const metadata = {
  title: 'Home',
};

/**
 * The authenticated home feed (docs/API.md §7, docs/FEATURES.md #10,
 * Milestone 12) — the stub shell from Milestone 6 now renders real,
 * fan-out-on-read content: posts from followed accounts, newest first,
 * never the viewer's own posts.
 */
export default async function HomePage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const [feed, unreadCount] = await Promise.all([
    apiClient.posts.getFeed(),
    apiClient.notifications.getUnreadCount(),
  ]);

  return (
    <main>
      <h1>Welcome, {user.username}</h1>
      <Link href={`/${user.username}`}>View profile</Link>
      <Link href="/posts/new">New post</Link>
      <NotificationBadge initialCount={unreadCount.count} />
      <form action={logoutAction}>
        <button type="submit">Log out</button>
      </form>
      <FeedList
        initialPosts={feed.data}
        initialNextCursor={feed.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
