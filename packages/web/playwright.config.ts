// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Playwright config — smoke / e2e tests for the Next.js app.
// Run via `npx playwright test` from packages/web.
//
// `webServer` boots `next dev` on port 3000 if nothing is already
// listening, so a local invocation needs no separate setup. CI can
// run the same config; the dev server start adds a few seconds to
// every cold run, which is fine for the smoke layer (single-digit
// tests).
//
// Backend-dependent tests (login flow, workspace + project CRUD,
// SheetTable / ServerDocView, presence) sit out of this config until
// the backend Testcontainers harness is wired into CI — those need
// a running PostgreSQL + Spring container, and the current Docker-
// daemon environment limitations block automating that locally.

import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
