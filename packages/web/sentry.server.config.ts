// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sentry Node-side init for the Next.js server runtime. Same gate
// as the browser config — empty DSN, no init.
//
// Status (2026-05-22): Soft off. Operator decision — at Phase B-3
// (MVP, real users = 0) Sentry's grouping/replay/alerting value is
// nil and the trial-end auto-downgrade to the Developer free plan
// adds management surface for no benefit. NEXT_PUBLIC_SENTRY_DSN
// has been removed from Vercel env (Production / Preview / Development);
// SDK now no-ops on every runtime. The Loki + Prometheus + Alertmanager
// + Discord webhook stack on prod_app covers the "an error happened"
// alerting path. Re-enable later by repopulating the DSN — no code
// change needed.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  });
}
