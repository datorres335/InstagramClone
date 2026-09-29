import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

/**
 * One row of a followers/following list (docs/FEATURES.md #6). The inline
 * follow/unfollow button renders for any authenticated viewer (`isFollowedByMe`
 * non-null), not only on the viewer's own list — same scope simplification as
 * the web equivalent (`apps/web/.../[username]/follow-list-item.tsx`), see
 * docs/PROGRESS.md's Milestone 10 deviations.
 */
export function FollowListItem({ item }: { item: FollowListItemType }) {
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
    <View style={styles.row}>
      {item.avatarUrl ? (
        <Image
          source={{ uri: item.avatarUrl }}
          accessibilityLabel={item.username}
          style={styles.avatar}
        />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      <Link href={`/profile/${item.username}`} style={styles.name}>
        {item.fullName
          ? `${item.fullName} (@${item.username})`
          : `@${item.username}`}
      </Link>
      {isFollowing !== null && (
        <View>
          <Pressable
            style={styles.button}
            onPress={handleToggle}
            disabled={pending}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {isFollowing ? 'Unfollow' : 'Follow'}
            </Text>
          </Pressable>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  name: { flex: 1 },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  error: { color: '#dc2626', fontSize: 12 },
});
