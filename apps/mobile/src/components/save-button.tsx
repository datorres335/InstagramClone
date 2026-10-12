import { useState } from 'react';
import { View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { colors, iconSize } from '@instagram-clone/design-tokens';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

interface SaveButtonProps {
  postId: string;
  initialIsSaved: boolean;
}

/**
 * The bookmark toggle — twin of apps/web's `SaveButton`. Accessible name
 * `Save`/`Unsave`, state in `accessibilityState.selected`. No count: saves
 * are private.
 */
export function SaveButton({ postId, initialIsSaved }: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setError(null);
    setPending(true);
    try {
      if (isSaved) {
        await apiClient.savedPosts.unsave(postId);
        setIsSaved(false);
      } else {
        await apiClient.savedPosts.save(postId);
        setIsSaved(true);
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="flex-row items-center">
      {error && (
        <Text
          variant="bodySmall"
          accessibilityRole="alert"
          style={{ color: colors.error, marginRight: 8 }}
        >
          {error}
        </Text>
      )}
      <IconButton
        icon={isSaved ? 'bookmark' : 'bookmark-border'}
        iconColor={colors.text}
        size={iconSize.md}
        onPress={handlePress}
        disabled={pending}
        accessibilityLabel={isSaved ? 'Unsave' : 'Save'}
        accessibilityState={{ selected: isSaved, disabled: pending }}
      />
    </View>
  );
}
