import { redirect } from 'next/navigation';

import { getApiClient } from '../../../../lib/get-api-client';
import { EditProfileForm } from './edit-profile-form';

export const metadata = {
  title: 'Edit profile',
};

export default async function EditProfilePage() {
  const apiClient = getApiClient();
  const user = await apiClient.auth.session();
  if (!user) redirect('/login');

  // `UserResponseSchema` (session) deliberately never includes `avatarUrl`
  // (docs/API.md §3) — the public profile shape is the only place it's
  // exposed, so it's fetched separately just to seed the uploader's preview.
  const profile = await apiClient.users.getProfile(user.username);

  return (
    <main>
      <h1>Edit profile</h1>
      <EditProfileForm
        initial={{
          fullName: user.fullName,
          bio: user.bio,
          websiteUrl: user.websiteUrl,
          isPrivate: user.isPrivate,
        }}
        currentAvatarUrl={profile.avatarUrl}
      />
    </main>
  );
}
