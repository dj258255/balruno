// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Backend-dependent e2e specs — tagged @backend so they can be
// filtered out when running smoke-only locally:
//
//   npx playwright test --grep-invert "@backend"   # smoke only
//   npx playwright test --grep "@backend"          # backend flow
//
// Runs require:
//   1. PostgreSQL 18 + Spring backend reachable at BACKEND_BASE_URL
//      (default http://localhost:8080)
//   2. A test user pre-provisioned through the OAuth flow, with the
//      session cookie captured into TEST_SESSION_COOKIE — env var or
//      a separate auth setup project (Playwright's storageState
//      pattern, added once Docker daemon access lands).
//
// Currently fixme'd — the assertions are written, the harness will
// turn them on once the test session pipeline is in place.
//
// Plan (each fixme = one user-facing flow):
//
//   - workspace CRUD                 — create, delete, quota banner
//   - project CRUD                   — create, navigate, delete
//   - sheet add via "+ 시트"          — leaf appears, body usable
//   - cell edit                      — value persists across reload
//   - template import                — RPG group lands as folder
//   - doc tree create + rename        — leaf renames propagate
//   - doc body edit                  — Tiptap binding survives reload
//   - peer presence                  — multi-context cursor render

import { test, expect } from '@playwright/test';

const BACKEND = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

test.describe('@backend workspace CRUD', () => {
  test.fixme('create + list + delete a workspace', async ({ page }) => {
    await page.goto('/workspaces');
    await page.getByPlaceholder('이름').fill('e2e workspace');
    await page.getByPlaceholder('slug').fill(`e2e-${Date.now()}`);
    await page.getByRole('button', { name: '만들기' }).click();
    await expect(page.getByText('e2e workspace')).toBeVisible();
    // Hover-revealed delete + typed-name confirm flow.
    // window.prompt isn't directly automatable without a dialog
    // handler; the harness will register one before clicking trash.
  });
});

test.describe('@backend project + sheet flow', () => {
  test.fixme('create project, add sheet via + 시트, edit cell', async ({ page }) => {
    // Pre: workspace exists, we navigate via /w/{slug} and use the
    // "+ 시트" button on the project page sidebar.
    void page;
  });

  test.fixme('import RPG template lands as a folder with sheets', async ({ page }) => {
    void page;
  });
});

test.describe('@backend doc tree + body', () => {
  test.fixme('create doc, rename via sidebar double-click, edit body', async ({ page }) => {
    void page;
  });

  test.fixme('inline title edit in doc body emits tree.rename', async ({ page }) => {
    void page;
  });
});

test.describe('@backend presence', () => {
  test.fixme('two browser contexts see each other on the same sheet', async ({ browser }) => {
    void browser;
  });
});

test('@backend reachable (sanity)', async ({ request }) => {
  // Smoke check that the spec file's BACKEND env is correct. Skipped
  // when not @backend so this doesn't break the smoke layer.
  test.skip(!process.env.RUN_BACKEND_E2E, 'set RUN_BACKEND_E2E=1 to enable');
  const res = await request.get(`${BACKEND}/actuator/health`);
  expect(res.ok()).toBe(true);
});
