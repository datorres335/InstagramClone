import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';

import { ApiError } from '@instagram-clone/api-client';
import type {
  CommentListResponse,
  PostResponse,
} from '@instagram-clone/validation';

import { CommentSection } from '../../components/comment-section';
import { PostCard } from '../../components/post-card';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/** Post detail view (docs/API.md §7) — see `apps/web`'s `/p/[id]` equivalent for the routing-convention note. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [comments, setComments] = useState<CommentListResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.all([apiClient.posts.getById(id), apiClient.comments.list(id)])
      .then(([postResult, commentsResult]) => {
        if (!cancelled) {
          setPost(postResult);
          setComments(commentsResult);
        }
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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          testID="loading-indicator"
          color={colors.textSecondary}
        />
      </View>
    );
  }

  if (notFound || !post) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text variant="titleLarge" role="heading">
          Post not found
        </Text>
      </View>
    );
  }

  const isAuthor = viewer?.username === post.author.username;

  return (
    <ScrollView className="flex-1 bg-background">
      <PostCard
        post={post}
        isAuthor={isAuthor}
        deleting={deleting}
        error={error}
        onDelete={handleDelete}
      />
      {comments && (
        <CommentSection
          postId={post.id}
          initialComments={comments.data}
          initialNextCursor={comments.meta.nextCursor}
          viewerUsername={viewer?.username ?? null}
          postAuthorUsername={post.author.username}
        />
      )}
    </ScrollView>
  );
}
