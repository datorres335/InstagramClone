import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors, layout } from '@instagram-clone/design-tokens';

import { tokenCssVariables } from './token-css-variables';

describe('tokenCssVariables', () => {
  const css = tokenCssVariables();

  it('emits a single :root rule', () => {
    expect(css.startsWith(':root{')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
  });

  it('emits every color token in kebab case', () => {
    expect(css).toContain(`--ig-color-primary: ${colors.primary}`);
    expect(css).toContain(`--ig-color-text-secondary: ${colors.textSecondary}`);
    expect(css).toContain(
      `--ig-color-surface-variant: ${colors.surfaceVariant}`,
    );
  });

  it('emits sizes in px', () => {
    expect(css).toContain(`--ig-layout-feed-width: ${layout.feedWidth}px`);
    expect(css).toContain('--ig-text-body: 14px');
    expect(css).toContain('--ig-radius-md: 8px');
  });

  // global.css maps Tailwind's theme onto these variables by name; a typo
  // there would silently fall back to Tailwind's defaults.
  it('defines every --ig-* variable global.css references', () => {
    const globalCss = readFileSync(
      join(import.meta.dirname, '../app/global.css'),
      'utf8',
    );
    const referenced = new Set(globalCss.match(/--ig-[a-z-]+/g));
    expect(referenced.size).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(css).toContain(`${name}:`);
    }
  });
});
