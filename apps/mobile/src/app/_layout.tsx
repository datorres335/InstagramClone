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

import { colors, typography } from '@instagram-clone/design-tokens';

import '../global.css';
import { AuthProvider } from '../lib/auth-context';
import { interFamily } from '../theme/fonts';
import { PaperIcon } from '../theme/paper-icon';
import { paperTheme } from '../theme/paper-theme';

const paperSettings = { icon: PaperIcon };

function usernameTitle(params: object | undefined): string {
  return params && 'username' in params && typeof params.username === 'string'
    ? `@${params.username}`
    : '';
}

/**
 * Screens pushed on top of the tabs (post, profile, lists, forms) get a
 * token-styled native header with a back button (Milestone 24) and the
 * bottom safe-area inset. The tab group, the auth screens and the index
 * redirect hide the header, so with Android's edge-to-edge layout they take
 * the top inset here instead; the tab bar handles the bottom inset itself.
 */
function RootStack() {
  const insets = useSafeAreaInsets();
  const headerless = {
    headerShown: false,
    contentStyle: {
      backgroundColor: colors.background,
      paddingTop: insets.top,
    },
  };

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: interFamily.semibold,
          fontSize: typography.bodyLarge.fontSize,
        },
        // Pushed screens have no tab bar under them, so they keep clear of
        // the home indicator here (Milestone 25).
        contentStyle: {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Stack.Screen name="index" options={headerless} />
      <Stack.Screen name="(tabs)" options={headerless} />
      {/* The auth screens sit on the surface color (like apps/web's), so the
          strip under the status bar should match it. */}
      <Stack.Screen
        name="(auth)"
        options={{
          ...headerless,
          contentStyle: {
            backgroundColor: colors.surface,
            paddingTop: insets.top,
          },
        }}
      />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="post/likes" options={{ title: 'Likes' }} />
      <Stack.Screen name="post/new" options={{ title: 'New post' }} />
      <Stack.Screen
        name="profile/[username]"
        options={({ route }) => ({ title: usernameTitle(route.params) })}
      />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="profile/followers" options={{ title: 'Followers' }} />
      <Stack.Screen name="profile/following" options={{ title: 'Following' }} />
      <Stack.Screen name="profile/saved" options={{ title: 'Saved posts' }} />
      <Stack.Screen name="profile/settings" options={{ title: 'Settings' }} />
      {/* The screen sets "@username" once the conversation has loaded. */}
      <Stack.Screen name="conversation/[id]" options={{ title: '' }} />
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
