import { AuthCard } from '../auth-card';
import { RegisterForm } from './register-form';

export const metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create account"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerHref="/login"
    >
      <RegisterForm />
    </AuthCard>
  );
}
