import { Link } from 'expo-router';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { PostResponse } from '@instagram-clone/validation';

interface PostCardProps {
  post: PostResponse;
  isAuthor: boolean;
  deleting: boolean;
  error: string | null;
  onDelete: () => void;
}

/**
 * Shared by the post detail screen (`post/[id].tsx`) and the home feed
 * (`(tabs)/home.tsx`, Milestone 12) — the second real consumer that
 * justified extracting this out of `post/[id].tsx`'s inline markup, the
 * same "duplicate until a second real consumer exists" threshold
 * `apps/web`'s `PostCard`/`buildQueryString` already applied.
 *
 * The inner `FlatList` (horizontal, paging) nested inside the feed's outer
 * vertical `FlatList` is intentional, not a nesting bug — React Native only
 * warns about nested lists sharing the *same* scroll orientation, and
 * Instagram's own feed uses this exact same-shape nesting for per-post
 * carousels.
 */
export function PostCard({
  post,
  isAuthor,
  deleting,
  error,
  onDelete,
}: PostCardProps) {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Link
        href={{
          pathname: '/profile/[username]',
          params: { username: post.author.username },
        }}
      >
        <Text style={styles.username} role="heading">
          @{post.author.username}
        </Text>
      </Link>
      {post.location && <Text>{post.location}</Text>}
      <FlatList
        horizontal
        pagingEnabled
        data={post.media}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            style={[styles.media, { width, height: width }]}
          />
        )}
      />
      {post.caption && <Text>{post.caption}</Text>}
      <Text>
        {post.likesCount} likes · {post.commentsCount} comments
      </Text>
      {isAuthor && (
        <View>
          <Pressable
            style={styles.deleteButton}
            onPress={onDelete}
            disabled={deleting}
            accessibilityRole="button"
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting…' : 'Delete post'}
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
  container: { backgroundColor: '#ffffff' },
  username: { fontSize: 18, fontWeight: '600', padding: 12 },
  media: { resizeMode: 'cover' },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    margin: 12,
  },
  deleteButtonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626', marginHorizontal: 12 },
});
