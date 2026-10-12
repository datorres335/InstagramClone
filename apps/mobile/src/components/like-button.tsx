import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { colors, iconSize } from '@instagram-clone/design-tokens';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

interface LikeButtonProps {
  postId: string;
  initialIsLiked: boolean;
  initialLikesCount: number;
}

/**
 * The heart toggle plus its "N likes" link — twin of apps/web's
 * `LikeButton`. Accessible name `Like`/`Unlike`, state in
 * `accessibilityState.selected`. Calls `apiClient` directly (no Server
 * Action indirection on mobile).
 */
export function LikeButton({
  postId,
  initialIsLiked,
  initialLikesCount,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setError(null);
    setPending(true);
    try {
      if (isLiked) {
        await apiClient.likes.unlike(postId);
        setIsLiked(false);
        setLikesCount((count) => count - 1);
      } else {
        await apiClient.likes.like(postId);
        setIsLiked(true);
        setLikesCount((count) => count + 1);
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="flex-row items-center">
      <IconButton
        icon={isLiked ? 'favorite' : 'favorite-border'}
        iconColor={isLiked ? colors.like : colors.text}
        size={iconSize.md}
        onPress={handlePress}
        disabled={pending}
        accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
        accessibilityState={{ selected: isLiked, disabled: pending }}
      />
      <Link href={{ pathname: '/post/likes', params: { postId } }} asChild>
        <Pressable accessibilityRole="link" hitSlop={8}>
          <Text variant="labelLarge">{likesCount} likes</Text>
        </Pressable>
      </Link>
      {error && (
        <Text
          variant="bodySmall"
          accessibilityRole="alert"
          style={{ color: colors.error, marginLeft: 8 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
