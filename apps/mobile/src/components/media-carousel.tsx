import { useState } from 'react';
import {
  FlatList,
  Image,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, frameAspect } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

/**
 * A post's photos: a paging horizontal list with page dots, framed at the
 * first photo's aspect ratio (shared `frameAspect`, so it matches apps/web's
 * `MediaCarousel`). The horizontal list inside the feed's vertical list is
 * the cross-direction nesting React Native supports, not a nesting bug.
 */
export function MediaCarousel({ media }: { media: PostResponse['media'] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = width / frameAspect(media[0]?.width, media[0]?.height);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ backgroundColor: colors.surfaceVariant }}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={media}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleMomentumEnd}
        accessibilityLabel={
          media.length > 1 ? `Photo ${index + 1} of ${media.length}` : undefined
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            accessibilityLabel={item.altText ?? undefined}
            style={{ width, height }}
            resizeMode="cover"
          />
        )}
      />
      {media.length > 1 && (
        <View
          className="absolute inset-x-0 bottom-2 flex-row justify-center gap-1"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {media.map((item, position) => (
            <View
              key={item.id}
              className={`h-1.5 w-1.5 rounded-full ${
                position === index ? 'bg-primary' : 'bg-background'
              }`}
              style={position === index ? undefined : { opacity: 0.7 }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
