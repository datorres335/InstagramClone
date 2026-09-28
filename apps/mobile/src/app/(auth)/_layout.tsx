import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../lib/auth-context';

/** Already logged in? Skip the auth screens — bounce straight to the authenticated shell. */
export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
