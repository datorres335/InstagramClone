import { colors, radii, typography } from '@instagram-clone/design-tokens';

import { interFamily } from './fonts';
import { paperTheme } from './paper-theme';

describe('paperTheme', () => {
  it('takes its color roles from the design tokens', () => {
    expect(paperTheme.colors.primary).toBe(colors.primary);
    expect(paperTheme.colors.onPrimary).toBe(colors.onPrimary);
    expect(paperTheme.colors.background).toBe(colors.background);
    expect(paperTheme.colors.onSurface).toBe(colors.text);
    expect(paperTheme.colors.onSurfaceVariant).toBe(colors.textSecondary);
    expect(paperTheme.colors.outline).toBe(colors.outline);
    expect(paperTheme.colors.error).toBe(colors.error);
  });

  it('keeps every elevation level flat, with no MD3 tonal tint', () => {
    const { level0, ...raised } = paperTheme.colors.elevation;
    expect(level0).toBe('transparent');
    for (const color of Object.values(raised)) {
      expect(color).toBe(colors.background);
    }
  });

  it('uses the token corner radius', () => {
    expect(paperTheme.roundness).toBe(radii.md);
  });

  it('sets every type style in Inter, at the token sizes', () => {
    const validFamilies = new Set(Object.values(interFamily));
    for (const [variant, style] of Object.entries(paperTheme.fonts)) {
      expect({ variant, family: validFamilies.has(style.fontFamily) }).toEqual({
        variant,
        family: true,
      });
    }
    expect(paperTheme.fonts.bodyMedium.fontSize).toBe(typography.body.fontSize);
    expect(paperTheme.fonts.labelLarge.fontFamily).toBe(interFamily.semibold);
    expect(paperTheme.fonts.headlineSmall.lineHeight).toBe(
      typography.headline.lineHeight,
    );
  });
});
