import { expect, type Locator } from '@playwright/test';

/**
 * Waits until React has hydrated the element behind `locator`.
 *
 * Right after a hard navigation the server-rendered HTML is interactive
 * before React has attached its handlers, so a `fill()`/`setInputFiles()` in
 * that window is silently dropped (the controlled state never updates, the
 * file list stays empty). Measured on WebKit: hydration lands ~200–350ms
 * after `goto()` returns locally, and later on CI's slower runners, which is
 * why fixed `waitForTimeout(500)` settles weren't reliable.
 *
 * React DOM marks every element it has hydrated with a `__reactProps$<id>`
 * property (stable across React 17–19); polling for it waits exactly as long
 * as needed and no longer.
 */
export async function waitForHydration(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith('__reactProps')),
        ),
      { message: 'waiting for React to hydrate the element' },
    )
    .toBe(true);
}
