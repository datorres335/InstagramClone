import { redirect } from 'next/navigation';

import { getApiClient } from '../../../../lib/get-api-client';
import { EditProfileForm } from './edit-profile-form';

export const metadata = {
  title: 'Edit profile',
};

export default async function EditProfilePage() {
  const user = await getApiClient().auth.session();
  if (!user) redirect('/login');

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
      />
    </main>
  );
}
