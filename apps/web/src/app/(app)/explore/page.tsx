import { redirect } from 'next/navigation';

import { getApiClient } from '../../../lib/get-api-client';
import { ExploreGrid } from './explore-grid';

export const metadata = {
  title: 'Explore',
};

/**
 * `GET /explore` (docs/API.md §11, docs/FEATURES.md #15, Milestone 18) —
 * required auth (unlike `GET /search/users`, which is optional).
 */
export default async function ExplorePage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  const explore = await apiClient.posts.getExplore();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-4">
      <h1 className="text-title font-semibold">Explore</h1>
      <ExploreGrid
        initialPosts={explore.data}
        initialNextCursor={explore.meta.nextCursor}
      />
    </main>
  );
}
