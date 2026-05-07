// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sentry browser-side init. Activated only when NEXT_PUBLIC_SENTRY_DSN
// is set — empty DSN keeps the SDK inert (no init, no network calls)
// so a self-host operator without a Sentry account isn't forced to
// register one.

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
    // Strip URLs to avoid leaking customer data via referrers; the
    // session id is the same one the WS handshake uses, no PII.
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
      }
      return event;
    },
  });
}
