import {
  MD3LightTheme,
  configureFonts,
  type MD3Theme,
} from 'react-native-paper';

import {
  colors,
  fontWeight,
  radii,
  typography,
  type TypeStyle,
} from '@instagram-clone/design-tokens';

import { interFamily } from './fonts';

function font(style: TypeStyle) {
  return {
    fontFamily: interFamily[style.fontWeight],
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: `${fontWeight[style.fontWeight]}` as const,
    letterSpacing: 0,
  };
}

/**
 * React Native Paper theme built from `@instagram-clone/design-tokens`
 * (docs/ARCHITECTURE.md §5.5). Paper's MD3 defaults are overridden so it
 * matches apps/web's MUI theme: token colors, flat surfaces (no MD3 tonal
 * elevation tint — every elevation level is the plain background), and the
 * shared type scale in Inter.
 */
export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  // Outlined TextInput uses `roundness` directly; Button multiplies it by 5
  // in MD3, so ui/button.tsx overrides it per component.
  roundness: radii.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.surfaceVariant,
    onPrimaryContainer: colors.text,
    secondary: colors.textSecondary,
    onSecondary: colors.onPrimary,
    secondaryContainer: colors.surfaceVariant,
    onSecondaryContainer: colors.text,
    background: colors.background,
    onBackground: colors.text,
    surface: colors.background,
    onSurface: colors.text,
    surfaceVariant: colors.surfaceVariant,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.outline,
    outlineVariant: colors.border,
    error: colors.error,
    onError: colors.onPrimary,
    elevation: {
      level0: 'transparent',
      level1: colors.background,
      level2: colors.background,
      level3: colors.background,
      level4: colors.background,
      level5: colors.background,
    },
  },
  fonts: configureFonts({
    config: {
      // The token scale has one display and one headline size; Paper's
      // larger variants use them too, so nothing falls back to Roboto.
      displayLarge: font(typography.display),
      displayMedium: font(typography.display),
      displaySmall: font(typography.display),
      headlineLarge: font(typography.headline),
      headlineMedium: font(typography.headline),
      headlineSmall: font(typography.headline),
      titleLarge: font(typography.title),
      titleMedium: font({ ...typography.bodyLarge, fontWeight: 'semibold' }),
      titleSmall: font(typography.label),
      labelLarge: font(typography.label),
      labelMedium: font({ ...typography.caption, fontWeight: 'semibold' }),
      labelSmall: font({ ...typography.caption, fontWeight: 'medium' }),
      bodyLarge: font(typography.bodyLarge),
      bodyMedium: font(typography.body),
      bodySmall: font(typography.caption),
      default: font(typography.body),
    },
  }),
};
