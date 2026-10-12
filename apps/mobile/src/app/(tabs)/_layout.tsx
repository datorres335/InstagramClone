import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, iconSize } from '@instagram-clone/design-tokens';

import { useAuth } from '../../lib/auth-context';
import {
  unreadTabBadge,
  useUnreadNotificationCount,
} from '../../lib/use-unread-notification-count';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface TabIconProps {
  focused: boolean;
  color: ColorValue;
}

/**
 * The Material Icons font only has filled glyphs for most of these, so the
 * active tab is shown by tint (and by `activeName` where an outlined/filled
 * pair exists) — the same glyphs and tints apps/web's nav uses.
 */
function tabIcon(name: IconName, activeName: IconName = name) {
  return function TabIcon({ focused, color }: TabIconProps) {
    return (
      <MaterialIcons
        name={focused ? activeName : name}
        color={color}
        size={iconSize.md}
      />
    );
  };
}

/**
 * The authenticated tab shell (docs/ARCHITECTURE.md §5.3/§5.5). Same order
 * and Material icons as apps/web's primary navigation, and icon-only like
 * web's phone-width bottom bar (six labels don't fit, and "Notifications"
 * truncated); each tab's `title` stays its accessibility label. Create and
 * Settings live in screens rather than tabs on mobile, matching the platform
 * convention of five or six bottom tabs. Colors go straight into
 * `screenOptions` rather than through Paper's `adaptNavigationTheme`, which
 * mistypes against SDK 56's expo-router navigation types.
 */
export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <SignedInTabs />;
}

/** Split out so the unread-count hook (which opens the realtime stream) only runs with a session. */
function SignedInTabs() {
  const unreadCount = useUnreadNotificationCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: tabIcon('explore') }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: tabIcon('send') }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: tabIcon('favorite-border', 'favorite'),
          ...unreadTabBadge(unreadCount),
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: colors.onPrimary,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('account-circle') }}
      />
    </Tabs>
  );
}
