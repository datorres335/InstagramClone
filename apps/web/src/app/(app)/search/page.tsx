import { getApiClient } from '../../../lib/get-api-client';
import { SearchBox } from './search-box';

export const metadata = {
  title: 'Search',
};

/**
 * `GET /search/users?q=` (docs/API.md §11, docs/FEATURES.md #14, Milestone
 * 17) — optional auth, no redirect for an anonymous visitor (the API
 * endpoint itself works without a session, the same "optional" posture
 * `GET /posts/:postId/likes` already has). The session is only read to hide
 * the Follow button on the viewer's own result row.
 */
export default async function SearchPage() {
  const viewer = await getApiClient().auth.session();

  return (
    <main className="mx-auto flex w-full max-w-feed flex-col gap-4">
      <h1 className="text-title font-semibold">Search</h1>
      <SearchBox viewerUsername={viewer?.username ?? null} />
    </main>
  );
}
