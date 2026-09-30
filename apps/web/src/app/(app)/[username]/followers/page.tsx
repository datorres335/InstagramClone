import { notFound } from 'next/navigation';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../../lib/get-api-client';
import { FollowListItem } from '../../follow-list-item';

interface FollowersPageProps {
  params: Promise<{ username: string }>;
}

export default async function FollowersPage({ params }: FollowersPageProps) {
  const { username } = await params;

  let result;
  try {
    result = await getApiClient().follows.getFollowers(username);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main>
      <h1>{username}&rsquo;s followers</h1>
      {result.data.length === 0 ? (
        <p>No followers yet.</p>
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
