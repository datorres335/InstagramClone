import { AuthCard } from '../auth-card';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Log in',
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Log in"
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerHref="/register"
    >
      <LoginForm />
    </AuthCard>
  );
}
