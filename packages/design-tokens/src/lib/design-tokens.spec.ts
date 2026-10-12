import {
  avatarSize,
  colors,
  fontWeight,
  frameAspect,
  layout,
  mediaAspect,
  radii,
  spacingUnit,
  typography,
  type ColorTokens,
} from './design-tokens';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.x contrast ratio. */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('colors', () => {
  it('uses six-digit hex values everywhere', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  // WCAG 2.1 AA: 4.5:1 for normal text (1.4.3), 3:1 for UI component
  // boundaries and graphical objects like icons (1.4.11).
  const textPairs: [keyof ColorTokens, keyof ColorTokens][] = [
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'surfaceVariant'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
    ['primary', 'background'],
    ['onPrimary', 'primary'],
    ['error', 'background'],
    ['success', 'background'],
  ];
  it.each(textPairs)('%s on %s meets 4.5:1', (foreground, background) => {
    expect(
      contrastRatio(colors[foreground], colors[background]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  const nonTextPairs: [keyof ColorTokens, keyof ColorTokens][] = [
    ['outline', 'background'],
    ['like', 'background'],
    ['primary', 'surface'],
  ];
  it.each(nonTextPairs)('%s on %s meets 3:1', (foreground, background) => {
    expect(
      contrastRatio(colors[foreground], colors[background]),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('typography', () => {
  it('only references defined font weights', () => {
    for (const style of Object.values(typography)) {
      expect(fontWeight).toHaveProperty(style.fontWeight);
    }
  });

  it('keeps line height at or above font size', () => {
    for (const style of Object.values(typography)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });
});

describe('spacing and sizes', () => {
  it('keeps corner radii on the spacing grid', () => {
    for (const value of Object.values(radii)) {
      if (value === radii.full) continue;
      expect(value % spacingUnit).toBe(0);
    }
  });

  it('meets the minimum touch target size', () => {
    expect(layout.minTouchTarget).toBeGreaterThanOrEqual(44);
  });

  it('frames photos at their own ratio within the 4:5 to 1.91:1 range', () => {
    expect(frameAspect(1080, 1080)).toBe(1);
    expect(frameAspect(1600, 1200)).toBeCloseTo(4 / 3);
    expect(frameAspect(1000, 2000)).toBe(mediaAspect.min);
    expect(frameAspect(4000, 1000)).toBe(mediaAspect.max);
    expect(frameAspect(null, 800)).toBe(1);
  });

  it('keeps avatar sizes increasing and on the spacing grid', () => {
    const sizes = Object.values(avatarSize);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    for (const size of sizes) {
      expect(size % 2).toBe(0);
    }
  });
});
