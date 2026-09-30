import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

interface LikeButtonProps {
  postId: string;
  initialIsLiked: boolean;
  initialLikesCount: number;
}

/** Local component state — `apiClient` is called directly (no Server Action indirection needed on mobile, per the established pattern). */
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
    <View style={styles.row}>
      <Pressable
        onPress={handlePress}
        disabled={pending}
        accessibilityRole="button"
      >
        <Text style={styles.likeText}>{isLiked ? 'Unlike' : 'Like'}</Text>
      </Pressable>
      <Link
        href={{ pathname: '/post/likes', params: { postId } }}
        style={styles.countLink}
      >
        {likesCount} likes
      </Link>
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
  likeText: { fontWeight: '600' },
  countLink: {},
  error: { color: '#dc2626' },
});
