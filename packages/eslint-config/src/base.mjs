// Shared ESLint flat-config rules for the whole monorepo.
//
// This is deliberately plain JavaScript (not TypeScript) because ESLint loads
// flat config files directly with Node, before any build step has run — every
// project's `eslint.config.mjs` imports the workspace root's `eslint.config.mjs`,
// which in turn spreads this array in. Framework-specific configs (Next, Nest,
// Expo) layer their own plugin configs on top of this in their own
// `eslint.config.mjs`; this file only holds rules that should apply everywhere.
//
// See docs/ARCHITECTURE.md §3.2 for the Nx module-boundary rules, which are
// configured in the workspace root eslint.config.mjs (they need root-relative
// project-graph context that doesn't belong in a shared, portable preset).

import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lodash', 'lodash/*'],
              message:
                'Prefer native JS/TS or a scoped utility over pulling in lodash.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Must come last: turns off any stylistic ESLint rules that would conflict
  // with Prettier, which owns all formatting decisions in this repo.
  eslintConfigPrettier,
];

export default baseConfig;
