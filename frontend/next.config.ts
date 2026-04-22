import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Formualizer (Rust+WASM 수식 엔진) 번들링.
  // webpack: asyncWebAssembly 를 명시적으로 켜야 wasm-bindgen 생성물이 import 됨.
  webpack: (config) => {
    config.experiments = {
      ...(config.experiments ?? {}),
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
