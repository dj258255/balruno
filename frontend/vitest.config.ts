import { defineConfig } from 'vitest/config';
import wasm from 'vite-plugin-wasm';
import path from 'path';

export default defineConfig({
  // Formualizer (Rust+WASM 엔진) 의 .wasm 파일을 async import 처리.
  // Node 20+ 는 top-level await 네이티브 지원이라 별도 플러그인 불필요.
  plugins: [wasm()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    // formualizer 는 wasm-bindgen bundler 타겟 — Vitest 가 externalize 하면
    // Node ESM loader 가 .wasm 을 읽지 못함. inline 으로 강제해서 vite-plugin-wasm
    // transform 이 적용되게 함.
    server: {
      deps: {
        inline: ['formualizer'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
