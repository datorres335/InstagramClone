import { useLocalSearchParams, Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ApiError,
  type PublicProfileResponse,
} from '@instagram-clone/api-client';

import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

/**
 * Public profile view (docs/API.md §4, docs/FEATURES.md #3) — the same
 * screen for "my own profile" (reached via the Profile tab) and anyone
 * else's; the only difference is whether the "Edit profile" link renders.
 * No Follow/Unfollow button yet — that's Milestone 10.
 */
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiClient.users
      .getProfile(username)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else {
          throw error;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={styles.container}>
        <Text role="heading">User not found</Text>
      </View>
    );
  }

  const isOwnProfile = viewer?.username === profile.username;

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        {profile.username}
      </Text>
      {profile.fullName && <Text>{profile.fullName}</Text>}
      {profile.bio && <Text>{profile.bio}</Text>}
      {profile.websiteUrl && <Text>{profile.websiteUrl}</Text>}
      <View style={styles.stats}>
        <Text>{profile.postsCount} posts</Text>
        <Text>{profile.followersCount} followers</Text>
        <Text>{profile.followingCount} following</Text>
      </View>
      {isOwnProfile && <Link href="/profile/edit">Edit profile</Link>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 20, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 16, marginVertical: 8 },
});
