'use client';

import { createTheme } from '@mui/material/styles';

import {
  colors,
  fontWeight,
  layout,
  radii,
  typography,
  type TypeStyle,
} from '@instagram-clone/design-tokens';

function typeStyle(style: TypeStyle) {
  return {
    fontSize: `${style.fontSize / 16}rem`,
    lineHeight: `${style.lineHeight / 16}rem`,
    fontWeight: fontWeight[style.fontWeight],
  };
}

/**
 * MUI theme built from `@instagram-clone/design-tokens` (docs/ARCHITECTURE.md
 * §5.5). A client module because the theme object holds functions, which
 * can't cross the Server → Client Component boundary.
 */
export const theme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: layout.mdBreakpoint, lg: 1200, xl: 1536 },
  },
  palette: {
    primary: { main: colors.primary, contrastText: colors.onPrimary },
    error: { main: colors.error },
    success: { main: colors.success },
    text: { primary: colors.text, secondary: colors.textSecondary },
    background: { default: colors.background, paper: colors.background },
    divider: colors.border,
  },
  shape: { borderRadius: radii.md },
  typography: {
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    h1: typeStyle(typography.display),
    h2: typeStyle(typography.headline),
    h3: typeStyle(typography.title),
    subtitle1: typeStyle(typography.label),
    body1: typeStyle(typography.body),
    body2: typeStyle(typography.caption),
    caption: typeStyle(typography.caption),
    button: { ...typeStyle(typography.label), textTransform: 'none' },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    // Paper's inputs on mobile show no required marker; the `required`
    // attribute still reaches assistive tech.
    MuiFormLabel: { styleOverrides: { asterisk: { display: 'none' } } },
    MuiOutlinedInput: {
      styleOverrides: { notchedOutline: { borderColor: colors.outline } },
    },
  },
});
