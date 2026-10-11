// Tailwind v3 (NativeWind 4 requires it; apps/web uses v4 — see
// docs/ARCHITECTURE.md §5.5 / risk #15). Every value comes from
// @instagram-clone/design-tokens, using the same utility names as apps/web's
// global.css (bg-primary, text-text-secondary, text-label, rounded-md, ...).
// Tailwind loads this file through jiti, which also compiles the TypeScript
// sources required below. Workspace packages resolve through tsconfig path
// aliases, which jiti doesn't read, hence the relative path.
const {
  colors,
  radii,
  typography,
  // eslint-disable-next-line @nx/enforce-module-boundaries
} = require('../../packages/design-tokens/src/index.ts');
const { interFamily } = require('./src/theme/fonts.ts');

const kebab = (name) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const mapKeys = (object, mapValue) =>
  Object.fromEntries(
    Object.entries(object).map(([name, value]) => [
      kebab(name),
      mapValue(value),
    ]),
  );

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: mapKeys(colors, (value) => value),
      fontSize: mapKeys(typography, (style) => [
        `${style.fontSize}px`,
        { lineHeight: `${style.lineHeight}px` },
      ]),
      fontFamily: {
        inter: [interFamily.regular],
        'inter-medium': [interFamily.medium],
        'inter-semibold': [interFamily.semibold],
        'inter-bold': [interFamily.bold],
      },
      borderRadius: mapKeys(radii, (value) => `${value}px`),
    },
  },
};
