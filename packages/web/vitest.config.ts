import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
  resolve: {
    alias: {
      // tsconfig.json paths -> a few entries that test files actually
      // import. Vitest does not parse tsconfig path mappings; each
      // alias used in *.test.ts has to be mirrored here. The catch-all
      // `@` matches the broader src tree.
      '@/lib/uuid': path.resolve(__dirname, '../shared/src/lib/uuid.ts'),
      '@balruno/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
