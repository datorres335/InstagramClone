import { useLocalSearchParams, Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { ApiError } from '@instagram-clone/api-client';
import { colors, iconSize } from '@instagram-clone/design-tokens';
import type {
  PostSummary,
  PublicProfileResponse,
} from '@instagram-clone/validation';

import { FollowButton } from '../../components/follow-button';
import {
  PostTile,
  postGridListProps,
  usePostTileSize,
} from '../../components/post-grid';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { UserAvatar } from '../../components/ui/user-avatar';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

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
  const tileSize = usePostTileSize();
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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          testID="loading-indicator"
          color={colors.textSecondary}
        />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text variant="titleLarge" role="heading">
          User not found
        </Text>
      </View>
    );
  }

  const isOwnProfile = viewer?.username === profile.username;

  return (
    <FlatList
      className="flex-1 bg-background"
      data={posts}
      {...postGridListProps}
      keyExtractor={(post) => post.id}
      ListHeaderComponent={
        <View className="gap-3 border-b border-border px-4 pt-4 pb-3">
          <View className="flex-row items-center gap-5">
            <UserAvatar
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              size="lg"
            />
            <View className="flex-1 gap-2">
              <Text variant="titleLarge" role="heading" numberOfLines={1}>
                {profile.username}
              </Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                <Text variant="bodyMedium">
                  <Text variant="labelLarge">{profile.postsCount}</Text> posts
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/profile/followers',
                      params: { username: profile.username },
                    })
                  }
                >
                  <Text variant="bodyMedium">
                    <Text variant="labelLarge">{profile.followersCount}</Text>{' '}
                    followers
                  </Text>
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
                  <Text variant="bodyMedium">
                    <Text variant="labelLarge">{profile.followingCount}</Text>{' '}
                    following
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <View className="gap-0.5">
            {profile.fullName && (
              <Text variant="labelLarge">{profile.fullName}</Text>
            )}
            {profile.bio && <Text variant="bodyMedium">{profile.bio}</Text>}
            {profile.websiteUrl && (
              <Text variant="labelLarge" style={{ color: colors.primary }}>
                {profile.websiteUrl}
              </Text>
            )}
          </View>
          {isOwnProfile && (
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Link href="/profile/edit" asChild>
                  <Button mode="outlined" compact>
                    Edit profile
                  </Button>
                </Link>
              </View>
              <View className="flex-1">
                <Link href="/profile/saved" asChild>
                  <Button mode="outlined" compact>
                    Saved
                  </Button>
                </Link>
              </View>
              <IconButton
                icon="settings"
                iconColor={colors.text}
                size={iconSize.md}
                accessibilityLabel="Settings"
                onPress={() => router.push('/profile/settings')}
              />
            </View>
          )}
          {!isOwnProfile && viewer && profile.isFollowedByMe !== null && (
            <FollowButton
              isFollowing={profile.isFollowedByMe}
              pending={followPending}
              error={followError}
              onPress={handleFollowToggle}
              block
            />
          )}
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="photo-camera" message="No posts yet." />
      }
      renderItem={({ item }) => (
        <PostTile
          postId={item.id}
          thumbnailUrl={item.thumbnailUrl}
          size={tileSize}
          testID={`post-tile-${item.id}`}
        />
      )}
    />
  );
}
