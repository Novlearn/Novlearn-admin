import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    // Official SDK files are CPU/memory-intensive. Two concurrent workers keep
    // them within the development host's budget; every deadline and assertion
    // remains unchanged, including the default five-second test deadline.
    maxWorkers: 2,
  },
});
