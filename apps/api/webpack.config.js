const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

// Built with a dynamic path (not a static string literal) so
// @nx/enforce-module-boundaries doesn't treat this as a cross-project
// import — it's build tooling reading the workspace root manifest, not
// application code depending on another project.
const rootPackageJson = require(join(__dirname, '../../package.json'));

// Internal `@instagram-clone/*` packages must be bundled, not externalized.
// By default NxAppWebpackPlugin externalizes anything resolvable through
// node_modules, which pnpm's workspace symlinks make true even for our own
// source packages — but their package.json `main` points at TypeScript
// output that's only ever compiled into dist/, not into the symlinked
// source directory, so `require('@instagram-clone/x')` fails at runtime.
// Bundling them (by leaving them off this list) sidesteps that entirely:
// their compiled-in-memory source is inlined into main.js directly, the
// same way our own apps/api/src files are. See docs/ARCHITECTURE.md §6.
const externalDependencies = Object.keys(
  rootPackageJson.dependencies ?? {},
).filter((name) => !name.startsWith('@instagram-clone/'));

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
      externalDependencies,
    }),
  ],
};
