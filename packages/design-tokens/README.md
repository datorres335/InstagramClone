# design-tokens

Framework-agnostic visual tokens (colors, type scale, spacing, radii, icon sizes,
layout widths) shared by `apps/web` and `apps/mobile`. Each app adapts them into its
own MUI / React Native Paper theme and Tailwind config — see
`docs/ARCHITECTURE.md` §5.5. No UI framework code belongs here.

- `nx test design-tokens` runs the unit tests, including WCAG AA contrast checks for
  every text/background pair the palette defines.
