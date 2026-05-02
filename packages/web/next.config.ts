import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // monorepo workspace 패키지 (@balruno/shared) 의 .ts 직접 트랜스파일
  transpilePackages: ['@balruno/shared'],
};

export default withNextIntl(nextConfig);
