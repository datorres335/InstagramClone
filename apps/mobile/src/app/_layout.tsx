import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../lib/auth-context';

// Root layout for Expo Router (file-based routing under src/app/). Route
// groups for the authenticated shell — (auth) for login/register, (tabs)
// for the authenticated shell (docs/ARCHITECTURE.md §5.3) — were added in
// Milestone 7, alongside the AuthProvider every screen below reads session
// state from.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
