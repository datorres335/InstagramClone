import { expect, test } from '@playwright/test';

import { randomRegisterInput } from './support/random-user';

const navLinks = [
  'Home',
  'Search',
  'Explore',
  'Messages',
  'Notifications',
  'Create',
  'Profile',
  'Settings',
];

test.describe('app shell (Milestone 23)', () => {
  test('shows the primary navigation as a left rail on desktop and a bottom bar on phones', async ({
    page,
  }) => {
    const credentials = randomRegisterInput();
    await page.goto('/register');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Username').fill(credentials.username);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL('/home');

    const nav = page.getByRole('navigation', { name: 'Primary' });

    // Desktop (Playwright's default 1280×720): a full-height rail on the left.
    for (const name of navLinks) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole('button', { name: 'Log out' })).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Home', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    const rail = await nav.boundingBox();
    expect(rail?.x).toBe(0);
    expect(rail?.height).toBe(720);

    // Phone width: the same links, docked to the bottom of the viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of navLinks) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const bar = await nav.boundingBox();
    expect(bar?.width).toBe(390);
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBe(844);

    await nav.getByRole('link', { name: 'Explore', exact: true }).click();
    await page.waitForURL('/explore');
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Explore', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('offers log in and sign up to logged-out visitors on public pages', async ({
    page,
  }) => {
    await page.goto('/search');

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Sign up' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(
      0,
    );
  });
});
