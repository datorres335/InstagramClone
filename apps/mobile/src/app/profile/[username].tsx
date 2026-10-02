import { useLocalSearchParams, Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiError } from '@instagram-clone/api-client';
import type {
  PostSummary,
  PublicProfileResponse,
} from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

const GRID_COLUMNS = 3;
const GRID_TILE_SIZE = 120;

/**
 * Public profile view (docs/API.md §4, docs/FEATURES.md #3) — the same
 * screen for "my own profile" (reached via the Profile tab) and anyone
 * else's; the only difference is whether the "Edit profile" link renders
 * (own profile) vs. a Follow/Unfollow button (someone else's, signed in
 * only — an anonymous viewer sees no button).
 */
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      apiClient.users.getProfile(username),
      apiClient.users.getPosts(username),
    ])
      .then(([profileResult, postsResult]) => {
        if (cancelled) return;
        setProfile(profileResult);
        setPosts(postsResult.data);
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

  async function handleFollowToggle() {
    if (!profile || profile.isFollowedByMe === null) return;
    setFollowError(null);
    setFollowPending(true);
    const wasFollowing = profile.isFollowedByMe;
    try {
      if (wasFollowing) {
        await apiClient.follows.unfollow(profile.username);
      } else {
        await apiClient.follows.follow(profile.username);
      }
      setProfile({
        ...profile,
        isFollowedByMe: !wasFollowing,
        followersCount: profile.followersCount + (wasFollowing ? -1 : 1),
      });
    } catch (caught) {
      setFollowError(authErrorMessage(caught));
    } finally {
      setFollowPending(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text role="heading">User not found</Text>
      </View>
    );
  }

  const isOwnProfile = viewer?.username === profile.username;

  return (
    <FlatList
      style={styles.container}
      data={posts}
      numColumns={GRID_COLUMNS}
      keyExtractor={(post) => post.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            {profile.username}
          </Text>
          {profile.fullName && <Text>{profile.fullName}</Text>}
          {profile.bio && <Text>{profile.bio}</Text>}
          {profile.websiteUrl && <Text>{profile.websiteUrl}</Text>}
          <View style={styles.stats}>
            <Text>{profile.postsCount} posts</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/profile/followers',
                  params: { username: profile.username },
                })
              }
            >
              <Text>{profile.followersCount} followers</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/profile/following',
                  params: { username: profile.username },
                })
              }
            >
              <Text>{profile.followingCount} following</Text>
            </Pressable>
          </View>
          {isOwnProfile && (
            <>
              <Link href="/profile/edit">Edit profile</Link>
              <Link href="/post/new">New post</Link>
              <Link href="/profile/saved">Saved posts</Link>
              <Link href="/profile/settings">Settings</Link>
            </>
          )}
          {!isOwnProfile && viewer && profile.isFollowedByMe !== null && (
            <View>
              <Pressable
                style={styles.button}
                onPress={handleFollowToggle}
                disabled={followPending}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>
                  {profile.isFollowedByMe ? 'Unfollow' : 'Follow'}
                </Text>
              </Pressable>
              {followError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {followError}
                </Text>
              )}
            </View>
          )}
          {posts.length === 0 && <Text>No posts yet.</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          testID={`post-tile-${item.id}`}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/post/[id]', params: { id: item.id } })
          }
        >
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={styles.gridTile}
            />
          ) : (
            <View style={[styles.gridTile, styles.gridTilePlaceholder]} />
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626' },
  gridTile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE,
    margin: 1,
  },
  gridTilePlaceholder: { backgroundColor: '#e5e7eb' },
});
