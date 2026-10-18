import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { newDraft } from '@/lib/catalogue';
import {
  readRecovery,
  writeRecovery,
  removeRecovery,
  clearRecoveries,
  recoveryBaseChanged,
  recoveryResource,
  recoveryLifetimeMs,
  type RecoveryCopy,
  type RecoveryStorage,
} from '@/lib/creator-recovery';
import { DraftMetadataForm } from '@/components/draft-metadata-form';
import {
  EditorRecoveryScope,
  AdminLogout,
} from '@/components/editor-recovery-scope';
import { bindEditorNavigation } from '@/lib/editor-navigation';
import { recoveryEndEvent } from '@/lib/creator-recovery';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());
const owner = 'http://127.0.0.1:55431|verified-admin';
const resource = recoveryResource('12', 'version-one');
const now = 1800000000000;
const copy = (): RecoveryCopy => ({
  schema: 1,
  resource,
  base: { fingerprint: 'a'.repeat(64), epoch: 3 },
  createRevision: false,
  updatedAt: now,
  definition: newDraft('Saisie privée'),
  skills: 'fractions, puissances',
});
function store() {
  const entries = new Map<string, string>();
  const storage: RecoveryStorage = {
    get length() {
      return entries.size;
    },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => {
      entries.set(k, v);
    },
    removeItem: (k) => {
      entries.delete(k);
    },
  };
  return { storage, entries };
}
it('retrouve une copie exacte après remontage, avec LaTeX, attendus et saisie incomplète inchangés', () => {
  const { storage } = store();
  const draft = copy();
  draft.definition.title = '';
  draft.definition.catalogue!.difficulty = 0;
  draft.definition.elements = [
    {
      id: 'question',
      type: 'question',
      text: '',
      points: 1,
      response: { format: 'latex', kind: 'rational' },
      expectedLatex: '\\frac{a}{b}',
      policy: { domain: 'rational', form: 'value-only' },
    },
  ];
  expect(writeRecovery(storage, owner, draft)).toBe(true);
  const mountedAgain = readRecovery(storage, owner, resource, now + 1000);
  expect(mountedAgain).toEqual({ state: 'ready', copy: draft });
  expect(draft.definition.title).toBe('');
});
it('sépare les comptes, les API locales, les exercices, les révisions et leur mode de création', () => {
  const { storage } = store();
  expect(writeRecovery(storage, owner, copy())).toBe(true);
  for (const other of [
    'http://127.0.0.1:55431|another-admin',
    'http://127.0.0.1:55432|verified-admin',
  ])
    expect(readRecovery(storage, other, resource, now).state).toBe('missing');
  for (const other of [
    recoveryResource('13', 'version-one'),
    recoveryResource('12', 'version-two'),
    recoveryResource('12', 'version-one', true),
  ])
    expect(readRecovery(storage, owner, other, now).state).toBe('missing');
  expect(recoveryResource()).not.toBe(recoveryResource('12'));
});
it('expire à la limite exacte, sans effacer arbitrairement une copie lors de sa lecture', () => {
  const { storage, entries } = store();
  writeRecovery(storage, owner, copy());
  expect(
    readRecovery(storage, owner, resource, now + recoveryLifetimeMs - 1).state,
  ).toBe('ready');
  expect(
    readRecovery(storage, owner, resource, now + recoveryLifetimeMs).state,
  ).toBe('expired');
  expect(entries.size).toBe(1);
});
it('détecte une référence modifiée sans confondre le hash avec une attestation ou une autorisation', () => {
  const draft = copy();
  expect(recoveryBaseChanged(draft, draft.base)).toBe(false);
  expect(recoveryBaseChanged(draft, { ...draft.base, epoch: 4 })).toBe(true);
  expect(
    recoveryBaseChanged(draft, { ...draft.base, fingerprint: 'b'.repeat(64) }),
  ).toBe(true);
});
it('conserve le choix nouvelle révision à travers plusieurs récupérations malgré une base actualisée', () => {
  const { storage } = store();
  const draft = copy();
  const newBase = { fingerprint: 'b'.repeat(64), epoch: 4 };
  expect(recoveryBaseChanged(draft, newBase)).toBe(true);
  const next = { ...draft, base: newBase, createRevision: true };
  expect(writeRecovery(storage, owner, next)).toBe(true);
  const recovered = readRecovery(storage, owner, resource, now + 5);
  if (recovered.state !== 'ready') throw Error('Copy missing');
  expect(recovered.copy.createRevision).toBe(true);
  expect(recoveryBaseChanged(recovered.copy, newBase)).toBe(false);
});
it.each([
  'not JSON',
  'null',
  JSON.stringify({ ...copy(), schema: 2 }),
  JSON.stringify({ ...copy(), resource: 'another version' }),
  JSON.stringify({ ...copy(), updatedAt: now + 1 }),
  JSON.stringify({ ...copy(), base: { fingerprint: 'not-a-hash', epoch: 3 } }),
  JSON.stringify({ ...copy(), base: { fingerprint: null, epoch: -1 } }),
  JSON.stringify({
    ...copy(),
    definition: { ...newDraft('Draft'), elements: 'bad' },
  }),
  JSON.stringify({
    ...copy(),
    definition: { ...newDraft('Draft'), catalogue: [] },
  }),
  JSON.stringify({ ...copy(), createRevision: 'true' }),
  JSON.stringify({ ...copy(), approval: 'forged' }),
])('refuse une copie illisible, étrangère ou altérée %#', (raw) => {
  const { storage, entries } = store();
  writeRecovery(storage, owner, copy());
  const entry = [...entries.keys()][0];
  entries.set(entry, raw);
  expect(readRecovery(storage, owner, resource, now).state).toBe('invalid');
  expect(entries.get(entry)).toBe(raw);
});
it('borne les octets Unicode et préserve la dernière copie si la nouvelle est trop grande', () => {
  const { storage, entries } = store();
  writeRecovery(storage, owner, copy());
  const previous = [...entries.values()][0];
  const huge = copy();
  huge.definition.elements = [
    { id: 'text', type: 'text', text: '😀'.repeat(70000) },
  ];
  expect(writeRecovery(storage, owner, huge)).toBe(false);
  expect([...entries.values()][0]).toBe(previous);
});
it('préserve l’ancienne copie quand le quota bloque une écriture et expose le refus', () => {
  const { storage } = store();
  writeRecovery(storage, owner, copy());
  const quota = {
    ...storage,
    setItem: () => {
      throw Error('PRIVATE quota detail');
    },
  };
  expect(
    writeRecovery(quota, owner, { ...copy(), skills: 'nouvelle saisie' }),
  ).toBe(false);
  expect(readRecovery(storage, owner, resource, now)).toEqual({
    state: 'ready',
    copy: copy(),
  });
});
it('gère un stockage bloqué sans lever ses détails privés dans l’interface', () => {
  const { storage } = store();
  const blocked = {
    ...storage,
    getItem: () => {
      throw Error('PRIVATE browser detail');
    },
    removeItem: () => {
      throw Error('PRIVATE browser detail');
    },
  };
  expect(readRecovery(blocked, owner, resource)).toEqual({
    state: 'unavailable',
  });
  expect(removeRecovery(blocked, owner, resource)).toBe(false);
});
it('efface seulement la copie demandée après sauvegarde ou abandon explicite', () => {
  const { storage } = store();
  const other = { ...copy(), resource: recoveryResource('13') };
  writeRecovery(storage, owner, copy());
  writeRecovery(storage, owner, other);
  expect(removeRecovery(storage, owner, resource)).toBe(true);
  expect(readRecovery(storage, owner, resource, now).state).toBe('missing');
  expect(readRecovery(storage, owner, other.resource, now).state).toBe('ready');
});
it('nettoie les copies des autres identités puis celles de déconnexion, sans toucher au reste du stockage', () => {
  const { storage, entries } = store();
  entries.set('unrelated-user-settings', 'PRESERVE');
  writeRecovery(storage, owner, copy());
  writeRecovery(storage, 'another-account', copy());
  expect(clearRecoveries(storage, owner)).toBe(true);
  expect(entries.size).toBe(2);
  expect(readRecovery(storage, owner, resource, now).state).toBe('ready');
  expect(clearRecoveries(storage)).toBe(true);
  expect([...entries.entries()]).toEqual([
    ['unrelated-user-settings', 'PRESERVE'],
  ]);
});
it('propose la conservation désactivée et explicite, sans lire ni écrire le navigateur au rendu serveur', () => {
  const getStorage = vi.fn(() => {
    throw Error('SSR must not read browser storage');
  });
  vi.stubGlobal('window', {
    get sessionStorage() {
      return getStorage();
    },
  });
  const html = renderToStaticMarkup(
    createElement(
      EditorRecoveryScope,
      {
        scope: owner,
      },
      createElement(DraftMetadataForm, {
        definition: newDraft('Exemple'),
      }),
    ),
  );
  expect(html).toContain('Conserver une copie de récupération dans cet onglet');
  expect(html).toContain('réponses attendues');
  expect(html).toContain('30 minutes');
  expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  const fields = html.match(/<fieldset[^>]*>/g) ?? [];
  expect(fields.length).toBeGreaterThanOrEqual(2);
  expect(fields.slice(0, 2).every((field) => field.includes('disabled'))).toBe(
    true,
  );
  expect(getStorage).not.toHaveBeenCalled();
});
it('n’offre aucune persistance à un composant dépourvu de contexte administrateur ou de banc synthétique', () => {
  const html = renderToStaticMarkup(
    createElement(DraftMetadataForm, { definition: newDraft('Exemple') }),
  );
  expect(html).not.toContain('Conserver une copie de récupération');
});
it('préserve les copies quand le départ est refusé, puis arrête les écrivains avant l’effacement de déconnexion', () => {
  const { storage } = store();
  writeRecovery(storage, owner, copy());
  const win = Object.assign(new EventTarget(), {
    sessionStorage: storage,
    confirm: vi.fn(() => false),
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', new EventTarget());
  const detach = bindEditorNavigation(() => true);
  const stopWriter = vi.fn(() => {
    expect(storage.length).toBe(1);
  });
  win.addEventListener(recoveryEndEvent, stopWriter);
  try {
    const submit = AdminLogout().props.onSubmit;
    const refused = { preventDefault: vi.fn() };
    submit(refused);
    expect(refused.preventDefault).toHaveBeenCalledOnce();
    expect(storage.length).toBe(1);
    expect(stopWriter).not.toHaveBeenCalled();
    win.confirm.mockReturnValue(true);
    const accepted = { preventDefault: vi.fn() };
    submit(accepted);
    expect(accepted.preventDefault).not.toHaveBeenCalled();
    expect(stopWriter).toHaveBeenCalledOnce();
    expect(storage.length).toBe(0);
  } finally {
    detach();
  }
});
it('signale un refus d’accès au stockage à la déconnexion, sans empêcher de quitter la session', () => {
  const win = Object.assign(new EventTarget(), { alert: vi.fn() });
  Object.defineProperty(win, 'sessionStorage', {
    get: () => {
      throw Error('PRIVATE storage policy detail');
    },
  });
  vi.stubGlobal('window', win);
  const event = { preventDefault: vi.fn() };
  expect(() => AdminLogout().props.onSubmit(event)).not.toThrow();
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(win.alert).toHaveBeenCalledOnce();
  expect(win.alert.mock.calls[0][0]).not.toContain('PRIVATE');
});
it('signale aussi un refus de suppression après accès réussi au stockage', () => {
  const { storage } = store();
  const blocked = {
    ...storage,
    get length() {
      throw Error('PRIVATE cleanup detail');
    },
  };
  const win = Object.assign(new EventTarget(), {
    sessionStorage: blocked,
    alert: vi.fn(),
  });
  vi.stubGlobal('window', win);
  const event = { preventDefault: vi.fn() };
  AdminLogout().props.onSubmit(event);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(win.alert).toHaveBeenCalledOnce();
  expect(win.alert.mock.calls[0][0]).not.toContain('PRIVATE');
});
it('garde le même chemin de déconnexion depuis une page au style Accès réservé, sans lecture navigateur en SSR', () => {
  const html = renderToStaticMarkup(AdminLogout({ buttonClassName: 'button' }));
  expect(html).toContain('action="/auth/logout"');
  expect(html).toContain('method="post"');
  expect(html).toContain('class="button"');
});
