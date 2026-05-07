// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Smoke tests that don't require backend / auth — verify the app
// builds, the local-mode home page renders, and key navigation
// surfaces are reachable. Backend-dependent flows (login,
// workspace, project, sheet) sit in separate spec files that
// require BACKEND_BASE_URL + a test user, brought in once the
// Testcontainers harness lands.

import { test, expect } from '@playwright/test';

test.describe('home (local mode)', () => {
  test('renders without backend', async ({ page }) => {
    await page.goto('/');
    // Home page boots into local mode when no backend session is
    // present. The exact heading wording is i18n-driven; we assert
    // on the document title since that's the most stable marker.
    await expect(page).toHaveTitle(/Balruno|밸런스/);
  });

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login');
    // Login renders the OAuth provider buttons. Looking for a
    // button is more stable than an exact text match.
    const buttons = page.locator('button, a[href*="oauth"]');
    await expect(buttons.first()).toBeVisible();
  });
});

test.describe('static routes', () => {
  test('terms of service renders', async ({ page }) => {
    const res = await page.goto('/terms');
    expect(res?.status()).toBeLessThan(400);
  });

  test('privacy policy renders', async ({ page }) => {
    const res = await page.goto('/privacy');
    expect(res?.status()).toBeLessThan(400);
  });

  test('pricing renders', async ({ page }) => {
    const res = await page.goto('/pricing');
    expect(res?.status()).toBeLessThan(400);
  });
});
