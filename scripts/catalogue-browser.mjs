import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src/', import.meta.url)),
      'next/navigation': fileURLToPath(
        new URL('../tests/browser/catalogue-navigation.ts', import.meta.url),
      ),
      'next/link': fileURLToPath(
        new URL('../tests/browser/catalogue-link.tsx', import.meta.url),
      ),
    },
  },
  esbuild: { jsx: 'automatic' },
  plugins: [
    {
      name: 'synthetic-catalogue-request',
      configureServer(server) {
        server.middlewares.use('/api/admin/review', (request, response) => {
          request.resume();
          response.statusCode = 409;
          response.setHeader('content-type', 'application/json');
          response.end(
            JSON.stringify({
              error:
                'Conflit synthétique : la révision a changé. Vos notes sont conservées.',
            }),
          );
        });
        server.middlewares.use('/api/admin/exercises', (request, response) => {
          request.resume();
          response.statusCode = 409;
          response.setHeader('content-type', 'application/json');
          response.end(
            JSON.stringify({
              error:
                'Conflit synthétique : le contenu a changé. Rechargez avant de réessayer.',
            }),
          );
        });
        server.middlewares.use('/api/admin/engine', (request, response) => {
          request.resume();
          response.statusCode = 503;
          response.setHeader('content-type', 'application/json');
          response.end(
            JSON.stringify({
              error:
                'Banc visuel : aucun runtime Engine connecté. Le test Linux est exécuté séparément.',
            }),
          );
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 3139,
    strictPort: true,
    open: false,
    cors: false,
    watch: { ignored: ['**/.next/**', '**/.npm-cache/**', '**/docs/**'] },
  },
});
await server.listen();
console.log(
  'Synthetic catalogue harness: http://127.0.0.1:3139/tests/browser/catalogue.html',
);
