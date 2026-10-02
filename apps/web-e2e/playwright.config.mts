import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
// Port 4200 (not Next's default 3000) — see apps/web/project.json's `dev`/
// `start` target overrides: apps/api also defaults to port 3000 (to match
// Nx's own generated api-e2e test harness), so web moved off it instead.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run the local dev servers before starting the tests — an array, not a
   * single entry (Milestone 20): `apps/api` doesn't start itself the way
   * `web:dev` does, which meant every prior milestone's web-e2e run needed
   * `nx run api:serve` started manually first (docs/PROGRESS.md's
   * long-standing Known Issue) or every test would fail against a
   * connection-refused API. Playwright's `webServer` option accepts a list
   * precisely for this "more than one process to bring up" case — both
   * entries are started/health-checked/torn down the same way `web:dev`
   * already was, so this needs Postgres/Redis/MinIO already running
   * (`docker compose up -d`) but nothing else manual. */
  webServer: [
    {
      command: 'pnpm exec nx run api:serve',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec nx run web:dev',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
