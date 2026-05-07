// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Next.js 16 / @sentry/nextjs v10 client instrumentation hook. The
// older `sentry.client.config.ts` auto-discovery was webpack-only;
// Turbopack (Next.js 16 default) requires the explicit
// `instrumentation-client.ts` filename to bundle the init into the
// client runtime. Same env gate as the other sentry.*.config files
// — empty DSN means SDK init is skipped, no network calls, no perf
// cost.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Replays gated behind a separate env var because they cost the
    // most quota — operators can opt in once they've validated the
    // base error signal.
    replaysSessionSampleRate: process.env.NEXT_PUBLIC_SENTRY_REPLAY === '1' ? 0.1 : 0,
    replaysOnErrorSampleRate: process.env.NEXT_PUBLIC_SENTRY_REPLAY === '1' ? 1.0 : 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    beforeSend(event) {
      // Strip URLs to avoid leaking customer data via referrers.
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
      }
      return event;
    },
  });
}

// Tracks client-side route transitions as Sentry transactions so a
// slow page load or a routing error gets attached to the right span.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
