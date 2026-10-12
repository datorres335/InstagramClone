import { FlatList, View } from 'react-native';

import { avatarSize } from '@instagram-clone/design-tokens';
import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { FollowListItem } from './follow-list-item';
import { EmptyState } from './ui/empty-state';
import { Skeleton } from './ui/skeleton';

interface UserListProps {
  /** `null` while loading. */
  items: FollowListItemType[] | null;
  emptyMessage: string;
  /** The signed-in viewer, whose own row gets no follow button. */
  viewerUsername: string | null;
}

/**
 * The likers, followers and following screens — twin of apps/web's
 * `UserList`. The screen title is in the native stack header.
 */
export function UserList({
  items,
  emptyMessage,
  viewerUsername,
}: UserListProps) {
  if (items === null) {
    return (
      <View
        testID="loading-indicator"
        accessibilityLabel="Loading"
        className="flex-1 gap-4 bg-background px-4 py-3"
      >
        {[0, 1, 2, 3].map((row) => (
          <View key={row} className="flex-row items-center gap-3">
            <Skeleton width={avatarSize.md} height={avatarSize.md} round />
            <View className="flex-1 gap-2">
              <Skeleton width="40%" height={12} />
              <Skeleton width="60%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="px-4"
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FollowListItem
          item={item}
          isViewer={item.username === viewerUsername}
        />
      )}
      ListEmptyComponent={
        <EmptyState icon="people-outline" message={emptyMessage} />
      }
    />
  );
}
