import type { FontWeightName } from '@instagram-clone/design-tokens';

/**
 * React Native can't synthesize weights from one custom font family, so each
 * token weight maps to its own loaded Inter face (@expo-google-fonts/inter).
 */
export const interFamily: Record<FontWeightName, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
