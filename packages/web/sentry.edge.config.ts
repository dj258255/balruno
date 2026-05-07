// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sentry edge runtime init (middleware, edge route handlers).
// Same gate — empty DSN keeps the SDK inert.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  });
}
