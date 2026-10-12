import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import type { CommentResponse } from '@instagram-clone/validation';

import { apiClient } from '../lib/api-client';
import { authErrorMessage } from '../lib/auth-error-message';
import { Button } from './ui/button';
import { TimeAgo } from './ui/time-ago';
import { UserAvatar } from './ui/user-avatar';

interface CommentSectionProps {
  postId: string;
  initialComments: CommentResponse[];
  initialNextCursor: string | null;
  viewerUsername: string | null;
  postAuthorUsername: string;
}

/**
 * The comment thread + add-comment form on the post detail screen only
 * (docs/IMPLEMENTATION_PLAN.md M14) — twin of apps/web's `CommentSection`.
 * Plain `.map()`, not a `FlatList` — this renders inside `post/[id].tsx`'s
 * outer `ScrollView`, and a vertical list inside a vertical `ScrollView` is
 * the same-direction nesting React Native warns about.
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
    <View className="gap-3 p-3">
      <Text variant="labelLarge" role="heading">
        Comments
      </Text>
      {comments.length === 0 && (
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
          No comments yet.
        </Text>
      )}
      {comments.map((comment) => {
        const canDelete =
          viewerUsername === comment.author.username ||
          viewerUsername === postAuthorUsername;
        return (
          <View key={comment.id} className="flex-row gap-3">
            <UserAvatar
              username={comment.author.username}
              avatarUrl={comment.author.avatarUrl}
              size="sm"
            />
            <View className="flex-1 gap-0.5">
              <Text variant="bodyMedium">
                <Text variant="labelLarge">@{comment.author.username}</Text>{' '}
                {comment.body}
              </Text>
              <View className="flex-row items-center gap-3">
                <TimeAgo iso={comment.createdAt} />
                {canDelete && (
                  <Pressable
                    onPress={() => handleDelete(comment.id)}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textSecondary }}
                    >
                      Delete
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {nextCursor && (
        <Button
          mode="text"
          onPress={handleLoadMore}
          disabled={loadingMore}
          style={{ alignSelf: 'flex-start' }}
        >
          {loadingMore ? 'Loading…' : 'Load more comments'}
        </Button>
      )}
      {viewerUsername && (
        <View className="flex-row items-center gap-2 border-t border-border pt-3">
          <TextInput
            mode="outlined"
            dense
            label="Add a comment"
            accessibilityLabel="Add a comment"
            value={body}
            onChangeText={setBody}
            maxLength={2200}
            multiline
            style={{ flex: 1 }}
          />
          <Button
            mode="text"
            onPress={handlePost}
            disabled={posting || !body.trim()}
          >
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </View>
      )}
      {error && (
        <HelperText type="error" accessibilityRole="alert">
          {error}
        </HelperText>
      )}
    </View>
  );
}
