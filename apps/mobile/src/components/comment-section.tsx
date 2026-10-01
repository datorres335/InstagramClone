import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CommentResponse } from '@instagram-clone/validation';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';

interface CommentSectionProps {
  postId: string;
  initialComments: CommentResponse[];
  initialNextCursor: string | null;
  viewerUsername: string | null;
  postAuthorUsername: string;
}

/**
 * The comment thread + add-comment form on the post detail screen only
 * (docs/IMPLEMENTATION_PLAN.md M14) — not the feed; `PostCard`'s comments
 * count is just a link to this screen there. Plain `.map()`, not a
 * `FlatList` — this renders inside `post/[id].tsx`'s outer `ScrollView`,
 * and nesting a vertical `FlatList` inside a vertical `ScrollView` (unlike
 * the feed's horizontal-in-vertical carousel nesting) is the same-direction
 * case React Native actually warns about.
 */
export function CommentSection({
  postId,
  initialComments,
  initialNextCursor,
  viewerUsername,
  postAuthorUsername,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    setPosting(true);
    try {
      const comment = await apiClient.comments.create(postId, {
        body: trimmed,
      });
      setComments((prev) => [...prev, comment]);
      setBody('');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    setError(null);
    try {
      await apiClient.comments.remove(postId, commentId);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch (caught) {
      setError(authErrorMessage(caught));
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiClient.comments.list(postId, {
        cursor: nextCursor,
      });
      setComments((prev) => [...prev, ...page.data]);
      setNextCursor(page.meta.nextCursor);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        Comments
      </Text>
      {comments.length === 0 && <Text>No comments yet.</Text>}
      {comments.map((comment) => {
        const canDelete =
          viewerUsername === comment.author.username ||
          viewerUsername === postAuthorUsername;
        return (
          <View key={comment.id} style={styles.row}>
            <Text style={styles.body}>
              <Text style={styles.author}>@{comment.author.username}</Text>{' '}
              {comment.body}
            </Text>
            {canDelete && (
              <Pressable
                onPress={() => handleDelete(comment.id)}
                accessibilityRole="button"
              >
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {nextCursor && (
        <Pressable
          onPress={handleLoadMore}
          disabled={loadingMore}
          accessibilityRole="button"
        >
          <Text style={styles.loadMore}>
            {loadingMore ? 'Loading…' : 'Load more comments'}
          </Text>
        </Pressable>
      )}
      {viewerUsername && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            accessibilityLabel="Add a comment"
            value={body}
            onChangeText={setBody}
            maxLength={2200}
            multiline
          />
          <Pressable
            style={styles.postButton}
            onPress={handlePost}
            disabled={posting || !body.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.postButtonText}>
              {posting ? 'Posting…' : 'Post'}
            </Text>
          </Pressable>
        </View>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1 },
  author: { fontWeight: '600' },
  delete: { color: '#dc2626', fontSize: 12 },
  loadMore: { color: '#2563eb' },
  form: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
  },
  postButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  postButtonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626' },
});
