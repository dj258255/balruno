// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sentry Node-side init for the Next.js server runtime. Same gate
// as the browser config — empty DSN, no init.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  });
}
