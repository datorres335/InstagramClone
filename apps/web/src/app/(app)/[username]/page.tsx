import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import Button from '@mui/material/Button';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { ApiError } from '@instagram-clone/api-client';

import { EmptyState } from '../../../components/ui/empty-state';
import { UserAvatar } from '../../../components/ui/user-avatar';
import { getApiClient } from '../../../lib/get-api-client';
import { FollowButton } from '../follow-button';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

/**
 * Public profile view (docs/API.md §4, docs/FEATURES.md #3) — works for
 * both "my own profile" and anyone else's; the only difference is whether
 * "Edit profile"/"Saved" render (own profile) vs. a Follow/Unfollow button
 * (someone else's, and only when signed in — an anonymous viewer sees no
 * button at all rather than one that would need a login redirect).
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

  const [viewer, posts] = await Promise.all([
    apiClient.auth.session(),
    apiClient.users.getPosts(username),
  ]);
  const isOwnProfile = viewer?.username === profile.username;

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6">
      <header className="flex items-start gap-6 md:gap-16 md:px-8">
        <UserAvatar
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          size="profile"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title">{profile.username}</h1>
            {isOwnProfile && (
              <>
                <Button
                  href="/profile/edit"
                  variant="outlined"
                  color="inherit"
                  size="small"
                  className="border-outline"
                >
                  Edit profile
                </Button>
                <Button
                  href="/saved"
                  variant="outlined"
                  color="inherit"
                  size="small"
                  className="border-outline"
                >
                  Saved
                </Button>
              </>
            )}
            {!isOwnProfile && viewer && profile.isFollowedByMe !== null && (
              <FollowButton
                username={profile.username}
                initialIsFollowing={profile.isFollowedByMe}
                size="small"
              />
            )}
          </div>
          <ul className="flex gap-6">
            <li>
              <span className="font-semibold">{profile.postsCount}</span> posts
            </li>
            <li>
              <Link
                href={`/${profile.username}/followers`}
                className="hover:underline"
              >
                <span className="font-semibold">{profile.followersCount}</span>{' '}
                followers
              </Link>
            </li>
            <li>
              <Link
                href={`/${profile.username}/following`}
                className="hover:underline"
              >
                <span className="font-semibold">{profile.followingCount}</span>{' '}
                following
              </Link>
            </li>
          </ul>
          <div className="flex flex-col gap-0.5">
            {profile.fullName && (
              <p className="font-semibold">{profile.fullName}</p>
            )}
            {profile.bio && (
              <p className="whitespace-pre-line wrap-break-word">
                {profile.bio}
              </p>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                {profile.websiteUrl}
              </a>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Posts" className="border-t border-border pt-4">
        {posts.data.length === 0 ? (
          <EmptyState
            icon={<PhotoCameraOutlinedIcon />}
            message="No posts yet."
          />
        ) : (
          <ul className="grid grid-cols-3 gap-1">
            {posts.data.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/p/${post.id}`}
                  aria-label="View post"
                  className="block aspect-square bg-surface-variant hover:opacity-90"
                >
                  {post.thumbnailUrl && (
                    <img
                      src={post.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
