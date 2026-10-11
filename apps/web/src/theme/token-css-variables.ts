import {
  colors,
  layout,
  radii,
  spacingUnit,
  typography,
} from '@instagram-clone/design-tokens';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Exposes `@instagram-clone/design-tokens` as `--ig-*` CSS custom properties
 * so `global.css`'s Tailwind `@theme` can reference them — keeping the
 * tokens package the only place a value is written down.
 */
export function tokenCssVariables(): string {
  const declarations: string[] = [];

  for (const [name, value] of Object.entries(colors)) {
    declarations.push(`--ig-color-${kebab(name)}: ${value}`);
  }
  for (const [name, style] of Object.entries(typography)) {
    declarations.push(`--ig-text-${kebab(name)}: ${style.fontSize}px`);
    declarations.push(
      `--ig-text-${kebab(name)}-line-height: ${style.lineHeight}px`,
    );
  }
  for (const [name, value] of Object.entries(radii)) {
    declarations.push(`--ig-radius-${kebab(name)}: ${value}px`);
  }
  for (const [name, value] of Object.entries(layout)) {
    declarations.push(`--ig-layout-${kebab(name)}: ${value}px`);
  }
  declarations.push(`--ig-spacing-unit: ${spacingUnit}px`);

  return `:root{${declarations.join(';')}}`;
}
