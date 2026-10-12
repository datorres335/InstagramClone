import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../../lib/get-api-client';
import { UserList } from '../../../user-list';

interface PostLikesPageProps {
  params: Promise<{ id: string }>;
}

/** A post's likers list (docs/API.md §8) — reuses `FollowListItem` verbatim, the same shape a followers/following row already is. */
export default async function PostLikesPage({ params }: PostLikesPageProps) {
  const { id } = await params;

  const apiClient = getApiClient();
  let result;
  try {
    result = await apiClient.likes.getLikers(id);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await apiClient.auth.session();

  return (
    <UserList
      title="Likes"
      items={result.data}
      viewerUsername={viewer?.username ?? null}
      emptyMessage="No likes yet."
    />
  );
}
