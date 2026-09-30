import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@instagram-clone/api-client';
import type { PostResponse } from '@instagram-clone/validation';

import { PostCard } from '../../components/post-card';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/** Post detail view (docs/API.md §7) — see `apps/web`'s `/p/[id]` equivalent for the routing-convention note. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
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
      <PostCard
        post={post}
        isAuthor={isAuthor}
        deleting={deleting}
        error={error}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
