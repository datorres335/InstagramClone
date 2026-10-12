import { router } from 'expo-router';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';

import { colors } from '@instagram-clone/design-tokens';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

/** Spread into a `FlatList` to lay its items out as the 3-column grid. */
export const postGridListProps = {
  numColumns: GRID_COLUMNS,
  columnWrapperStyle: { gap: GRID_GAP },
  contentContainerStyle: { gap: GRID_GAP },
} as const;

/** The tile edge that fits three tiles and their gaps across the screen. */
export function usePostTileSize(): number {
  const { width } = useWindowDimensions();
  return (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
}

interface PostTileProps {
  postId: string;
  thumbnailUrl: string | null;
  size: number;
  testID?: string;
}

/**
 * One square thumbnail of the profile and Explore grids — twin of apps/web's
 * `PostGrid`. A tile without a thumbnail (or still loading one) keeps its
 * square on the surface color.
 */
export function PostTile({
  postId,
  thumbnailUrl,
  size,
  testID,
}: PostTileProps) {
  const square = { width: size, height: size };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="View post"
      onPress={() =>
        router.push({ pathname: '/post/[id]', params: { id: postId } })
      }
    >
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={{ ...square, backgroundColor: colors.surfaceVariant }}
        />
      ) : (
        <View className="bg-surface-variant" style={square} />
      )}
    </Pressable>
  );
}
