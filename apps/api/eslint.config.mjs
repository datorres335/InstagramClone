import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // NestJS's constructor-based dependency injection relies on
      // `emitDecoratorMetadata`, which needs a real (value) import of every
      // injected class in scope — `import type` erases that binding and
      // silently breaks DI at runtime. See docs/ARCHITECTURE.md §5.2.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
