import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import * as path from 'node:path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // monorepo workspace package (@balruno/shared) — transpile .ts directly
  transpilePackages: ['@balruno/shared'],
  // Electron desktop packaging requires a standalone Node server bundle.
  // .next/standalone/packages/web/server.js + .next/standalone/node_modules/* are produced.
  output: 'standalone',
  // Standalone bundle must include monorepo workspace files outside packages/web.
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
};

// Sentry build-time integration. Wraps the build to inject runtime
// hooks, upload source maps (when SENTRY_AUTH_TOKEN + org + project
// are set), and tag releases. When NEXT_PUBLIC_SENTRY_DSN is empty
// the wrapper is skipped entirely so a self-host fork without a
// Sentry account can build the app — same gate as the runtime
// configs in sentry.{client,server,edge}.config.ts.
const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

const finalConfig: NextConfig = sentryEnabled
  ? withSentryConfig(withNextIntl(nextConfig), {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Skip upload errors during build when SENTRY_AUTH_TOKEN is
      // missing — common in PR builds without the secret wired.
      silent: !process.env.CI,
      // Disable telemetry the plugin sends about itself.
      telemetry: false,
    })
  : withNextIntl(nextConfig);

export default finalConfig;
