import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const fake = vi.hoisted(() => ({ configuration: vi.fn() }));
vi.mock('@/lib/auth/config', () => ({
  readAuthConfiguration: fake.configuration,
}));
import Login from '@/app/login/page';

afterEach(() => vi.unstubAllEnvs());
async function render(error?: string) {
  return renderToStaticMarkup(
    await Login({ searchParams: Promise.resolve({ error }) }),
  );
}

it('propose l’aperçu quand la connexion de développement est fermée sans activer le formulaire', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  fake.configuration.mockReturnValue(null);
  const html = await render();
  expect(html).toContain('href="http://127.0.0.1:3140/"');
  expect(html).toContain('exemples fictifs, sans compte ni');
  expect(html).toContain('Configuration de connexion incomplète');
  expect(html).not.toContain('prérequis de sécurité');
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
    expect(html).toContain('Configuration de connexion incomplète');
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

it('ne conserve pas une ancienne erreur disabled après configuration du serveur', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  fake.configuration.mockReturnValue({ local: false });
  const html = await render('disabled');
  expect(html).not.toContain('Configuration de connexion incomplète');
  expect(html).not.toContain('prérequis de sécurité');
  expect(html).not.toContain('disabled=""');
  expect(html).toContain('action="/auth/login"');
});
