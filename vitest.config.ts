import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    // Official SDK tests are CPU-intensive. Bound parallel workers rather than
    // relaxing per-test deadlines or Engine assertions on development machines.
    maxWorkers: 4,
  },
});
