import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import './prepare-mathlive.mjs';

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 3138,
    strictPort: true,
    open: false,
    cors: false,
    watch: { ignored: ['**/.next/**', '**/.npm-cache/**', '**/docs/**'] },
  },
});
await server.listen();
console.log(
  'MathLive test harness: http://127.0.0.1:3138/tests/browser/math-input.html',
);
