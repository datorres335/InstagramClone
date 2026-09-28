import { expect, test } from '@playwright/test';

import { randomRegisterInput } from './support/random-user';

test.describe('auth: register -> home -> logout', () => {
  test('completes the full lifecycle through real pages, against the real API', async ({
    page,
  }) => {
    const credentials = randomRegisterInput();

    await page.goto('/register');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Username').fill(credentials.username);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL('/home');
    await expect(
      page.getByRole('heading', { name: `Welcome, ${credentials.username}` }),
    ).toBeVisible();

    // Already authenticated — /login and /register should bounce back to /home.
    await page.goto('/login');
    await page.waitForURL('/home');

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('/login');

    // Session is gone — the protected route should bounce to /login.
    await page.goto('/home');
    await page.waitForURL('/login');
  });

  test('logs an existing user in', async ({ page }) => {
    const credentials = randomRegisterInput();
    await page.goto('/register');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Username').fill(credentials.username);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL('/home');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('/login');

    await page.getByLabel('Email or username').fill(credentials.username);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await page.waitForURL('/home');
    await expect(
      page.getByRole('heading', { name: `Welcome, ${credentials.username}` }),
    ).toBeVisible();
  });

  test('shows an error and stays on the page for a wrong password', async ({
    page,
  }) => {
    const credentials = randomRegisterInput();
    await page.goto('/register');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Username').fill(credentials.username);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL('/home');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('/login');

    await page.getByLabel('Email or username').fill(credentials.username);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated visitors are redirected away from /home', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
