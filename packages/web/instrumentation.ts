// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Next.js instrumentation hook — runs once on server boot. Picks the
// matching sentry.*.config.ts based on the runtime so the Node and
// Edge bundles each get their own Sentry init. The hooks are no-ops
// when SENTRY_DSN env is empty (each sentry.*.config skips Sentry.init).
//
// Required by @sentry/nextjs >= 8 — the older sentry.server.config.ts
// auto-discovery was removed.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: 'Pages Router' | 'App Router'; routePath: string; routeType: 'render' | 'route' | 'action' | 'middleware' },
) => {
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
};
