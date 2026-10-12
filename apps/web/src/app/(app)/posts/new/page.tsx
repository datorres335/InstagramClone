import { redirect } from 'next/navigation';

import { getApiClient } from '../../../../lib/get-api-client';
import { CreatePostForm } from './create-post-form';

export const metadata = {
  title: 'New post',
};

export default async function NewPostPage() {
  const user = await getApiClient().auth.session();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto flex w-full max-w-feed flex-col gap-6">
      <h1 className="text-title font-semibold">New post</h1>
      <CreatePostForm />
    </main>
  );
}
