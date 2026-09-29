module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // `@nestjs/bullmq` (and its `@nestjs/bull-shared` dependency) ship ESM-only
  // (`export`/`import` syntax, no CJS build) — Jest's default
  // `transformIgnorePatterns` skips all of `node_modules`, which leaves
  // those two untranspiled and fails with "Unexpected token 'export'".
  // `.*` (not an anchored match) is needed because pnpm's resolved real path
  // nests two separate `node_modules` segments
  // (`node_modules/.pnpm/@nestjs+bullmq@.../node_modules/@nestjs/bullmq`) —
  // an anchored lookahead would only clear the first.
  transformIgnorePatterns: [
    'node_modules/(?!.*(@nestjs\\+bullmq|@nestjs/bullmq|@nestjs\\+bull-shared|@nestjs/bull-shared))',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
};
