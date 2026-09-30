import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../../lib/get-api-client';
import { FollowListItem } from '../../../follow-list-item';

interface PostLikesPageProps {
  params: Promise<{ id: string }>;
}

/** A post's likers list (docs/API.md §8) — reuses `FollowListItem` verbatim, the same shape a followers/following row already is. */
export default async function PostLikesPage({ params }: PostLikesPageProps) {
  const { id } = await params;

  let result;
  try {
    result = await getApiClient().likes.getLikers(id);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main>
      <h1>Likes</h1>
      {result.data.length === 0 ? (
        <p>No likes yet.</p>
      ) : (
        <ul>
          {result.data.map((item) => (
            <FollowListItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
