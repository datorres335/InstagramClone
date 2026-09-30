import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ApiError } from '@instagram-clone/api-client';
import type { PostResponse } from '@instagram-clone/validation';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/** Post detail view (docs/API.md §7) — see `apps/web`'s `/p/[id]` equivalent for the routing-convention note. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
  const { width } = useWindowDimensions();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiClient.posts
      .getById(id)
      .then((result) => {
        if (!cancelled) setPost(result);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.problem.status === 404) {
          setNotFound(true);
        } else {
          throw caught;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await apiClient.posts.remove(id);
      router.replace({
        pathname: '/profile/[username]',
        params: { username: post?.author.username ?? '' },
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator testID="loading-indicator" />
      </View>
    );
  }

  if (notFound || !post) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text role="heading">Post not found</Text>
      </View>
    );
  }

  const isAuthor = viewer?.username === post.author.username;

  return (
    <View style={styles.container}>
      <Text style={styles.username} role="heading">
        @{post.author.username}
      </Text>
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
            onPress={handleDelete}
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
