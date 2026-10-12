import { View, type DimensionValue } from 'react-native';

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  round?: boolean;
}

/**
 * A token-colored loading placeholder — the mobile counterpart of MUI's
 * `Skeleton` (Paper has none; docs/ARCHITECTURE.md §5.5 parity map).
 */
export function Skeleton({ width, height, round = false }: SkeletonProps) {
  return (
    <View
      className={`bg-surface-variant ${round ? 'rounded-full' : 'rounded-sm'}`}
      style={{ width, height }}
    />
  );
}
