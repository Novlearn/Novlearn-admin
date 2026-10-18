import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const fake = vi.hoisted(() => ({ configuration: vi.fn() }));
vi.mock('@/lib/auth/config', () => ({
  readAuthConfiguration: fake.configuration,
}));
import Login from '@/app/login/page';

afterEach(() => vi.unstubAllEnvs());
async function render() {
  return renderToStaticMarkup(
    await Login({ searchParams: Promise.resolve({}) }),
  );
}

it('propose l’aperçu quand la connexion de développement est fermée sans activer le formulaire', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  fake.configuration.mockReturnValue(null);
  const html = await render();
  expect(html).toContain('href="http://127.0.0.1:3140/"');
  expect(html).toContain('exemples fictifs, sans compte ni');
  expect(html).toContain('Connexion en attente d’activation');
  expect(html).toContain('action="/auth/login"');
  expect(html.match(/disabled=""/g)).toHaveLength(3);
  expect(html).not.toContain('target="_blank"');
});

it.each(['production', 'test'])(
  'ne propose aucune destination loopback dans la page %s',
  async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    fake.configuration.mockReturnValue(null);
    const html = await render();
    expect(html).not.toContain('http://127.0.0.1:3140/');
    expect(html).toContain('Connexion en attente d’activation');
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  },
);

it('conserve le parcours de connexion configuré sans lui substituer l’aperçu', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  // Rendering-only double: no live authentication or remote client is invoked.
  fake.configuration.mockReturnValue({ local: true });
  const html = await render();
  expect(html).not.toContain('http://127.0.0.1:3140/');
  expect(html).not.toContain('disabled=""');
  expect(html).toContain('action="/auth/login"');
  expect(html).toContain('uniquement dans la base de test de cet ordinateur');
});
