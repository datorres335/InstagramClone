import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { UserList } from '../../user-list';

interface FollowingPageProps {
  params: Promise<{ username: string }>;
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { username } = await params;

  const apiClient = getApiClient();
  let result;
  try {
    result = await apiClient.follows.getFollowing(username);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await apiClient.auth.session();

  return (
    <UserList
      title="Following"
      items={result.data}
      viewerUsername={viewer?.username ?? null}
      emptyMessage="Not following anyone yet."
    />
  );
}
