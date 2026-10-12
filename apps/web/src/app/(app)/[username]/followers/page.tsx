import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { UserList } from '../../user-list';

interface FollowersPageProps {
  params: Promise<{ username: string }>;
}

export default async function FollowersPage({ params }: FollowersPageProps) {
  const { username } = await params;

  const apiClient = getApiClient();
  let result;
  try {
    result = await apiClient.follows.getFollowers(username);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await apiClient.auth.session();

  return (
    <UserList
      title="Followers"
      items={result.data}
      viewerUsername={viewer?.username ?? null}
      emptyMessage="No followers yet."
    />
  );
}
