import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../../lib/auth-context';

/**
 * The "Profile" tab is just a redirect to `/profile/<your own username>` —
 * the same screen used for viewing anyone else's profile
 * (`app/profile/[username].tsx`), so there's no separate "my profile" view
 * to keep in sync with the shared one.
 */
export default function ProfileTabScreen() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  return <Redirect href={`/profile/${user.username}`} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
