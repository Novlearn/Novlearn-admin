// Synthetic UI harnesses only; never loads Auth configuration or Supabase.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import './prepare-mathlive.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  configFile: false,
  root,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src/', import.meta.url)),
      'next/link': fileURLToPath(
        new URL('../tests/browser/catalogue-link.tsx', import.meta.url),
      ),
      'next/navigation': fileURLToPath(
        new URL('../tests/browser/catalogue-navigation.ts', import.meta.url),
      ),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 3140,
    strictPort: true,
    open: false,
    cors: false,
    watch: { ignored: ['**/.next/**', '**/.git/**', '**/docs/**'] },
  },
});
await server.listen();
console.log(
  'Synthetic local UI: http://127.0.0.1:3140/tests/browser/flashcards.html ; type stop to close.',
);
process.stdin.on('data', async (value) => {
  if (String(value).trim() === 'stop') {
    await server.close();
    process.exit(0);
  }
});
