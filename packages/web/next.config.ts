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
  // URL migration — Linear-style routes (/{ws}, /{ws}/projects/{p},
  // /{ws}/settings) are the new canonical paths. The previous
  // /w/{slug}/* paths stay alive via 308 permanent redirect so any
  // bookmark / share-link / external reference keeps resolving.
  // Browser + search-engine caches update on first hit. The
  // redirect is cheap on Vercel and the right thing to keep
  // forever — GitHub / Notion / Linear all follow the same pattern
  // for renamed-resource URLs.
  async redirects() {
    return [
      // /w/{slug}/p/{projectSlug} → /{slug}/projects/{projectSlug}
      {
        source: '/w/:slug/p/:projectSlug',
        destination: '/:slug/projects/:projectSlug',
        permanent: true,
      },
      // /w/{slug}/settings → /{slug}
      // (Settings is a modal now — Phase G dropped the standalone
      //  /:slug/settings route. Bookmarks land on the workspace
      //  home, where the user opens the Settings modal from the
      //  workspace switcher menu.)
      {
        source: '/w/:slug/settings',
        destination: '/:slug',
        permanent: true,
      },
      // /w/{slug} → /{slug}
      {
        source: '/w/:slug',
        destination: '/:slug',
        permanent: true,
      },
    ];
  },

  // Security response headers applied to every frontend response.
  // The CSP ships in *Report-Only* mode first so violations land in
  // the browser console (and any wired-up reporting endpoint)
  // without breaking the page — once the violation set settles,
  // flip the header name to `Content-Security-Policy` to enforce.
  //
  // 'unsafe-inline' + 'unsafe-eval' on script-src reflect what
  // Next.js currently needs for hydration data + Stripe's loader
  // shim; tightening to a nonce-based policy is a separate piece
  // of work coupled with Next's CSP middleware support.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.ingest.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.balruno.com wss://collab.balruno.com https://*.ingest.sentry.io https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com https://github.com https://api.balruno.com",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // X-Frame-Options DENY pairs with frame-ancestors 'none' in
          // the CSP — modern browsers honour the latter, legacy ones
          // fall back to the former. Both blanket-deny iframing.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
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
