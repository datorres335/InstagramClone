import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Root layout for Expo Router (file-based routing under src/app/). Route
// groups for the authenticated shell ((auth), (tabs), etc. — see
// docs/ARCHITECTURE.md §5.3) are added in the milestones that implement
// those screens; this infrastructure milestone only wires up the router
// itself with a single placeholder route (./index.tsx).
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
