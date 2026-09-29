import { notFound } from 'next/navigation';
import Link from 'next/link';

import { ApiError } from '@instagram-clone/api-client';

import { getApiClient } from '../../../lib/get-api-client';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

/**
 * Public profile view (docs/API.md §4, docs/FEATURES.md #3) — works for
 * both "my own profile" and anyone else's; the only difference is whether
 * the "Edit profile" link renders. No Follow/Unfollow button yet — that's
 * Milestone 10 (`Follow` doesn't exist until then, and `isFollowedByMe` is
 * a hardcoded stub — see docs/PROGRESS.md's Milestone 8 deviations).
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const apiClient = getApiClient();

  let profile;
  try {
    profile = await apiClient.users.getProfile(username);
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await apiClient.auth.session();
  const isOwnProfile = viewer?.username === profile.username;

  return (
    <main>
      <h1>{profile.username}</h1>
      {profile.fullName && <p>{profile.fullName}</p>}
      {profile.bio && <p>{profile.bio}</p>}
      {profile.websiteUrl && (
        <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
          {profile.websiteUrl}
        </a>
      )}
      <ul>
        <li>{profile.postsCount} posts</li>
        <li>{profile.followersCount} followers</li>
        <li>{profile.followingCount} following</li>
      </ul>
      {isOwnProfile && <Link href="/profile/edit">Edit profile</Link>}
    </main>
  );
}
