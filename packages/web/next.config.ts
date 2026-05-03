import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
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

export default withNextIntl(nextConfig);
