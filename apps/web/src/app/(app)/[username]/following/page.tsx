import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { FollowListItem } from '../follow-list-item';

interface FollowingPageProps {
  params: Promise<{ username: string }>;
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { username } = await params;

  let result;
  try {
    result = await getApiClient().follows.getFollowing(username);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main>
      <h1>Accounts {username} follows</h1>
      {result.data.length === 0 ? (
        <p>Not following anyone yet.</p>
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
