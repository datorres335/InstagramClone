import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { colors } from '@instagram-clone/design-tokens';

import '../global.css';
import { AuthProvider } from '../lib/auth-context';
import { PaperIcon } from '../theme/paper-icon';
import { paperTheme } from '../theme/paper-theme';

const paperSettings = { icon: PaperIcon };

/**
 * Every screen hides the native header, so with Android's edge-to-edge
 * layout their content would draw under the status bar; the top inset is
 * applied once here rather than in each screen. The tab bar handles the
 * bottom inset itself.
 */
function RootStack() {
  const insets = useSafeAreaInsets();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      }}
    >
      {/* The auth screens sit on the surface color (like apps/web's), so the
          strip under the status bar should match it. */}
      <Stack.Screen
        name="(auth)"
        options={{
          contentStyle: {
            backgroundColor: colors.surface,
            paddingTop: insets.top,
          },
        }}
      />
    </Stack>
  );
}

// Root layout for Expo Router (file-based routing under src/app/): the
// (auth) and (tabs) groups (docs/ARCHITECTURE.md §5.3), wrapped in the
// session context and, since Milestone 23, the design-token Paper theme
// (docs/ARCHITECTURE.md §5.5).
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // A failed font load falls back to the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={paperSettings}>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
