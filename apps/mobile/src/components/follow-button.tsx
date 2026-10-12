import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';

import { Button } from './ui/button';

interface FollowButtonProps {
  isFollowing: boolean;
  pending: boolean;
  error: string | null;
  onPress: () => void;
  compact?: boolean;
  /** Stretch to the container's width (the profile header) instead of hugging the label (list rows). */
  block?: boolean;
}

/**
 * Filled primary "Follow", outlined "Unfollow" — the same pairing as apps/web's
 * `FollowButton`. Presentational: the profile screen and list rows own the
 * follow state (the profile screen also adjusts its follower count).
 */
export function FollowButton({
  isFollowing,
  pending,
  error,
  onPress,
  compact = false,
  block = false,
}: FollowButtonProps) {
  return (
    <View className={`gap-1 ${block ? 'items-stretch' : 'items-end'}`}>
      <Button
        mode={isFollowing ? 'outlined' : 'contained'}
        onPress={onPress}
        disabled={pending}
        compact={compact}
        accessibilityRole="button"
      >
        {isFollowing ? 'Unfollow' : 'Follow'}
      </Button>
      {error && (
        <Text
          variant="bodySmall"
          accessibilityRole="alert"
          style={{ color: colors.error }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
