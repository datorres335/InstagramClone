import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

interface SaveButtonProps {
  postId: string;
  initialIsSaved: boolean;
}

/**
 * Local component state, mirroring `LikeButton` — `apiClient` is called
 * directly (no Server Action indirection needed on mobile). No count to
 * track here (unlike likes, saves are private — there's no "N saves" to
 * show anyone), just the boolean toggle.
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
    <View style={styles.row}>
      <Pressable
        onPress={handlePress}
        disabled={pending}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>{isSaved ? 'Unsave' : 'Save'}</Text>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { fontWeight: '600' },
  error: { color: '#dc2626' },
});
