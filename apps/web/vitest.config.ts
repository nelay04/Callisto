import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The units under test are pure format/state helpers, deliberately kept
    // free of DOM and Web Audio dependencies so they run in plain Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
