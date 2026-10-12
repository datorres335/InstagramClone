import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';
import { FollowButton } from './follow-button';
import { UserAvatar } from './ui/user-avatar';

interface FollowListItemProps {
  item: FollowListItemType;
  /** The row is the signed-in viewer themself — no follow button. */
  isViewer?: boolean;
}

/**
 * One row of a followers/following/likers list (docs/FEATURES.md #6) — twin
 * of apps/web's `FollowListItem`: avatar, "@username" with the full name
 * underneath, and a follow toggle for any authenticated viewer
 * (docs/PROGRESS.md's Milestone 10 deviations) — except on the viewer's own
 * row, where `isFollowedByMe` is a self-check that is always false.
 */
export function FollowListItem({
  item,
  isViewer = false,
}: FollowListItemProps) {
  const [isFollowing, setIsFollowing] = useState(item.isFollowedByMe);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setError(null);
    setPending(true);
    try {
      if (isFollowing) {
        await apiClient.follows.unfollow(item.username);
        setIsFollowing(false);
      } else {
        await apiClient.follows.follow(item.username);
        setIsFollowing(true);
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3 py-2">
      <UserAvatar
        username={item.username}
        avatarUrl={item.avatarUrl}
        size="md"
      />
      <Link href={`/profile/${item.username}`} asChild>
        <Pressable accessibilityRole="link" className="flex-1">
          <Text variant="labelLarge" numberOfLines={1}>
            @{item.username}
          </Text>
          {item.fullName && (
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={{ color: colors.textSecondary }}
            >
              {item.fullName}
            </Text>
          )}
        </Pressable>
      </Link>
      {isFollowing !== null && !isViewer && (
        <FollowButton
          isFollowing={isFollowing}
          pending={pending}
          error={error}
          onPress={handleToggle}
          compact
        />
      )}
    </View>
  );
}
