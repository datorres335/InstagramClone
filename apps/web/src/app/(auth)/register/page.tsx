import Link from 'next/link';

import { RegisterForm } from './register-form';

export const metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <main>
      <h1>Create account</h1>
      <RegisterForm />
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
