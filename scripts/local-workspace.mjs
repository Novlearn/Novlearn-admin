// Isolated development harness. Never imported by the Next application.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceOrigin = 'http://127.0.0.1:3140';
const root = fileURLToPath(new URL('../', import.meta.url));
export function localWorkspaceConfig({ engine = null } = {}) {
  const json = (response, status, body) => {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(body));
  };
  return {
    configFile: false,
    envDir: false,
    root,
    resolve: {
      alias: {
        '@': path.join(root, 'src'),
        'next/link': path.join(root, 'tests/browser/catalogue-link.tsx'),
        'next/navigation': path.join(
          root,
          'tests/browser/catalogue-navigation.ts',
        ),
      },
    },
    oxc: { jsx: { runtime: 'automatic' } },
    server: {
      host: '127.0.0.1',
      port: 3140,
      strictPort: true,
      open: false,
      cors: false,
      fs: {
        strict: true,
        allow: [root],
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key}',
          '**/.git/**',
          '**/.local/**',
          '**/.agents/**',
          '**/.codex/**',
        ],
      },
      watch: {
        ignored: [
          '**/.next/**',
          '**/.git/**',
          '**/.local/**',
          '**/.npm-cache/**',
          '**/docs/**',
        ],
      },
    },
    plugins: [
      {
        name: 'isolated-local-workspace',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            if (request.url === '/') {
              response.writeHead(302, {
                location: '/tests/browser/index.html',
              });
              response.end();
              return;
            }
            if (request.url === '/__local/status') {
              json(response, 200, {
                synthetic: true,
                database: false,
                engine: engine !== null,
              });
              return;
            }
            if (!request.url?.startsWith('/api/')) return next();
            // No proxy, remote destination, login or successful database mutation.
            if (
              request.method !== 'POST' ||
              request.headers.origin !== workspaceOrigin
            ) {
              request.resume();
              json(response, 403, {
                error: 'Origine ou méthode refusée dans cet essai local.',
              });
              return;
            }
            const operation =
              request.url === '/api/admin/engine'
                ? 'validate'
                : request.url === '/api/admin/preview'
                  ? 'preview'
                  : null;
            if (!operation || !engine) {
              request.resume();
              json(response, 503, {
                error: operation
                  ? 'Le moteur Linux n’est pas connecté à cet essai local.'
                  : 'Cette opération nécessite une base et une session Admin. Aucune donnée n’a été enregistrée par cet essai.',
              });
              return;
            }
            if (
              request.headers['content-type']?.split(';')[0].trim() !==
              'application/json'
            ) {
              request.resume();
              json(response, 415, { error: 'Format JSON requis.' });
              return;
            }
            try {
              const chunks = [];
              let size = 0;
              for await (const chunk of request) {
                size += chunk.length;
                if (size > 262144) {
                  request.resume();
                  json(response, 413, {
                    error: 'Requête locale trop volumineuse.',
                  });
                  return;
                }
                chunks.push(chunk);
              }
              let body;
              try {
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              } catch {
                json(response, 400, { error: 'JSON local invalide.' });
                return;
              }
              if (
                !body ||
                typeof body !== 'object' ||
                Array.isArray(body) ||
                (operation === 'validate'
                  ? Object.keys(body).length !== 1 ||
                    !Object.hasOwn(body, 'definition')
                  : !['generate', 'inspect', 'grade', 'test'].includes(
                      body.action,
                    ))
              ) {
                json(response, 400, { error: 'Requête locale invalide.' });
                return;
              }
              const result = await engine(
                operation === 'validate'
                  ? { action: 'validate', definition: body.definition }
                  : body,
              );
              json(response, result.status, result.body);
            } catch {
              json(response, 503, {
                error:
                  'Moteur local indisponible. Aucun résultat n’est validé.',
              });
            }
          });
        },
      },
    ],
  };
}
