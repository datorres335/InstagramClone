/**
 * The single source of visual truth for apps/web and apps/mobile
 * (docs/ARCHITECTURE.md §5.5). Plain values only — each app adapts these into
 * its own MUI / React Native Paper theme and Tailwind config.
 */

export interface ColorTokens {
  /** Primary actions and links. */
  primary: string;
  /** Text and icons drawn on top of `primary`. */
  onPrimary: string;
  /** Page background. */
  background: string;
  /** Raised or grouped areas (cards, nav, secondary buttons' hover). */
  surface: string;
  /** Secondary button fill, input fill, chat bubbles from other people. */
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  /** Decorative dividers and card edges. */
  border: string;
  /** Boundaries of interactive controls (text fields), which need 3:1 contrast. */
  outline: string;
  error: string;
  success: string;
  /** The filled "liked" heart. */
  like: string;
}

/** Light palette. A dark palette, when added, implements the same `ColorTokens`. */
export const colors: ColorTokens = {
  primary: '#0074CC',
  onPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FAFAFA',
  surfaceVariant: '#EFEFEF',
  text: '#0C1014',
  textSecondary: '#737373',
  border: '#DBDBDB',
  outline: '#8E8E8E',
  error: '#D62839',
  success: '#1F7A3A',
  like: '#FF3040',
};

export const fontFamily = 'Inter';

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export type FontWeightName = keyof typeof fontWeight;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeightName;
}

/** Sizes in px (web converts to rem, mobile uses them as dp). */
export const typography = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 'regular' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: 'regular' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: 'semibold' },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: 'regular' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: 'semibold' },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: 'semibold' },
  display: { fontSize: 32, lineHeight: 40, fontWeight: 'bold' },
} as const satisfies Record<string, TypeStyle>;

/** Every spacing value is a multiple of this (px / dp). */
export const spacingUnit = 4;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const iconSize = {
  sm: 20,
  md: 24,
  lg: 28,
} as const;

export const layout = {
  /** Width of the home-feed column. */
  feedWidth: 470,
  /** Widest any page's content column gets. */
  contentMaxWidth: 935,
  /** Width of the web left navigation rail at the `md` breakpoint and up. */
  navRailWidth: 244,
  /** Width of the login/register card. */
  authCardWidth: 350,
  /** Minimum touch target on mobile (dp) and minimum clickable size on web. */
  minTouchTarget: 48,
  /** Viewport width (px) where the web layout switches from bottom bar to rail. */
  mdBreakpoint: 768,
} as const;
