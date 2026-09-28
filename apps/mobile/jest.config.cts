/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '[.]svg$': '@nx/expo/plugins/jest/svg-mock',
    // Jest resolves bare specifiers via node_modules, which for these
    // workspace packages points at unbuilt dist/ output (docs/ARCHITECTURE.md
    // §6) — map straight to source, same fix apps/web's vitest.config.mts
    // needed for the same reason.
    '^@instagram-clone/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    '^@instagram-clone/validation$': '<rootDir>/../../packages/validation/src/index.ts',
    '^@instagram-clone/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@instagram-clone/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  transform: {
    '[.][jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+[.](bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
};
