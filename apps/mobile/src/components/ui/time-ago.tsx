import { Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import { formatTimeAgo } from '@instagram-clone/types';

/** A post/comment age ("3h", "2d") — the same text as apps/web's `TimeAgo` (shared `formatTimeAgo`). */
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
      {formatTimeAgo(iso)}
    </Text>
  );
}
