import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getApiClient } from '../../../lib/get-api-client';
import { SavedPostsList } from './saved-posts-list';

export const metadata = {
  title: 'Saved posts',
};

/**
 * `GET /me/saved` (docs/API.md §10, docs/FEATURES.md #13, Milestone 15) —
 * the caller's own saved posts, newest first. Not a public route (there's
 * no "this user's saved posts" concept for anyone but the saver), so this
 * page redirects anonymous visitors to `/login`, the same guard `/home`
 * already applies.
 */
export default async function SavedPostsPage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const saved = await apiClient.savedPosts.getSaved();

  return (
    <main>
      <h1>Saved posts</h1>
      <Link href={`/${user.username}`}>Back to profile</Link>
      <SavedPostsList
        initialPosts={saved.data}
        initialNextCursor={saved.meta.nextCursor}
        viewerUsername={user.username}
      />
    </main>
  );
}
