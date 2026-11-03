// Synthetic read-only taxonomy for browser reception. No .env or database access.
import { createServer } from 'vite';
import { localWorkspaceConfig } from './local-workspace.mjs';
const config = localWorkspaceConfig();
config.plugins.unshift({
  name: 'mission-taxonomy-fixture',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (
        !request.url?.startsWith('/api/admin/taxonomy?') ||
        request.method !== 'GET'
      )
        return next();
      const url = new URL(request.url, 'http://127.0.0.1:3140');
      const q = url.searchParams.get('q') ?? '';
      const kind = url.searchParams.get('kind');
      response.setHeader('content-type', 'application/json');
      response.setHeader('cache-control', 'no-store');
      if (q === 'panne') {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: 'Synthetic failure' }));
        return;
      }
      const chapters = [
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Suites numériques',
        },
        { id: '10000000-0000-4000-8000-000000000002', name: 'Dérivation' },
      ];
      const list =
        kind === 'chapter'
          ? chapters.map((c) => ({
              id: c.id,
              value: {
                name: c.name,
                aliases:
                  c.name === 'Suites numériques' ? ['Suites et limites'] : [],
                order_index: 0,
                emoji: '',
              },
            }))
          : Array.from({ length: 26 }, (_, i) => ({
              id: `competence_${i + 1}`,
              value: {
                id: `competence_${i + 1}`,
                name: `Compétence ${i + 1}`,
                chapter_id: chapters[i === 25 ? 1 : 0].id,
                max_points: 10,
              },
            }));
      const filtered = list.filter(
        (item) =>
          (!url.searchParams.get('chapter') ||
            item.value.chapter_id === url.searchParams.get('chapter') ||
            kind === 'chapter') &&
          JSON.stringify(item).toLowerCase().includes(q.toLowerCase()),
      );
      const start = (Number(url.searchParams.get('page') ?? 1) - 1) * 25;
      response.end(
        JSON.stringify({
          environment: 'staging',
          result: {
            items: filtered.slice(start, start + 25),
            total: filtered.length,
            chapters,
          },
        }),
      );
    });
  },
});
const server = await createServer(config);
await server.listen();
console.log(
  'Synthetic mission UI: http://127.0.0.1:3140/tests/browser/creator.html ; type stop to close.',
);
process.stdin.on('data', async (v) => {
  if (String(v).trim() === 'stop') {
    await server.close();
    process.exit(0);
  }
});
