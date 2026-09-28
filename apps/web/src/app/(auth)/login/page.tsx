import Link from 'next/link';

import { LoginForm } from './login-form';

export const metadata = {
  title: 'Log in',
};

export default function LoginPage() {
  return (
    <main>
      <h1>Log in</h1>
      <LoginForm />
      <p>
        Don&apos;t have an account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
