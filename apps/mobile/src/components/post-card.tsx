import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { colors, iconSize } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

import { LikeButton } from './like-button';
import { MediaCarousel } from './media-carousel';
import { SaveButton } from './save-button';
import { TimeAgo } from './ui/time-ago';
import { UserAvatar } from './ui/user-avatar';

interface PostCardProps {
  post: PostResponse;
  isAuthor: boolean;
  deleting: boolean;
  error: string | null;
  onDelete: () => void;
}

/**
 * Shared by the post detail screen (`post/[id].tsx`) and the home feed
 * (`(tabs)/home.tsx`) — twin of apps/web's `PostCard`, in the same order:
 * author header, photo carousel, an action row with each icon next to its
 * count (heart + "N likes", bubble + "N comments", bookmark on the right),
 * caption, and the post's age.
 */
export function PostCard({
  post,
  isAuthor,
  deleting,
  error,
  onDelete,
}: PostCardProps) {
  const profileHref = {
    pathname: '/profile/[username]' as const,
    params: { username: post.author.username },
  };

  return (
    <View className="border-b border-border bg-background pb-3">
      <View className="flex-row items-center gap-3 px-3 py-2">
        <UserAvatar
          username={post.author.username}
          avatarUrl={post.author.avatarUrl}
          size="sm"
        />
        <View className="flex-1">
          <Link href={profileHref} asChild>
            <Pressable accessibilityRole="link">
              <Text variant="labelLarge" role="heading">
                @{post.author.username}
              </Text>
            </Pressable>
          </Link>
          {post.location && (
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              {post.location}
            </Text>
          )}
        </View>
        {isAuthor && (
          <IconButton
            icon="delete-outline"
            iconColor={colors.textSecondary}
            size={iconSize.md}
            onPress={onDelete}
            disabled={deleting}
            accessibilityLabel="Delete post"
          />
        )}
      </View>
      {error && (
        <Text
          variant="bodySmall"
          accessibilityRole="alert"
          style={{ color: colors.error, paddingHorizontal: 12 }}
        >
          {error}
        </Text>
      )}

      <MediaCarousel media={post.media} />

      <View className="flex-row items-center gap-1 px-1">
        {post.isLikedByMe === null ? (
          <View className="flex-row items-center gap-2 px-3 py-3">
            <MaterialIcons
              name="favorite-border"
              size={iconSize.md}
              color={colors.text}
            />
            <Link
              href={{ pathname: '/post/likes', params: { postId: post.id } }}
              asChild
            >
              <Pressable accessibilityRole="link">
                <Text variant="labelLarge">{post.likesCount} likes</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <LikeButton
            postId={post.id}
            initialIsLiked={post.isLikedByMe}
            initialLikesCount={post.likesCount}
          />
        )}
        <Link
          href={{ pathname: '/post/[id]', params: { id: post.id } }}
          asChild
        >
          <Pressable
            accessibilityRole="link"
            className="min-h-12 flex-row items-center gap-2 px-2"
          >
            <MaterialIcons
              name="chat-bubble-outline"
              size={iconSize.md}
              color={colors.text}
            />
            <Text variant="labelLarge">{post.commentsCount} comments</Text>
          </Pressable>
        </Link>
        <View className="flex-1" />
        {post.isSavedByMe !== null && (
          <SaveButton postId={post.id} initialIsSaved={post.isSavedByMe} />
        )}
      </View>

      <View className="gap-1 px-3">
        {post.caption && (
          <Text variant="bodyMedium">
            <Text variant="labelLarge">@{post.author.username}</Text>{' '}
            {post.caption}
          </Text>
        )}
        <TimeAgo iso={post.createdAt} />
      </View>
    </View>
  );
}
