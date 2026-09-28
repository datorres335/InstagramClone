import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '../../lib/auth-context';

/**
 * The authenticated shell (docs/ARCHITECTURE.md §5.3). A single "Home" tab
 * today — a stub, same as `apps/web`'s `/home` (Milestone 6) — real tabs
 * (feed, explore, notifications) land in later milestones as those features
 * do; the `Tabs` structure exists now so adding them is additive.
 */
export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Tabs screenOptions={{ headerShown: false }} />;
}
