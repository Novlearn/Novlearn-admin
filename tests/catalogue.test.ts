import { describe, expect, it } from 'vitest';
import {
  catalogueFilter,
  draftEnvelope,
  isExerciseId,
  isUuid,
  newDraft,
  revisionDiff,
  readSavedDraft,
} from '@/lib/catalogue';
import { readBoundedJson } from '@/lib/auth/json';

describe('contrats du catalogue', () => {
  it('n’accepte une confirmation de sauvegarde que pour les identifiants attendus sans arrondir les bigint', () => {
    const versionId = '9a000000-0000-0000-0000-000000000001';
    const newerId = '9a000000-0000-0000-0000-000000000002';
    const result = { exerciseId: '9007199254740993', versionId };
    const body = { environment: 'staging', result };
    expect(readSavedDraft(body, {})).toEqual(result);
    expect(readSavedDraft(body, result)).toEqual(result);
    expect(readSavedDraft(body, { ...result, newRevision: true })).toBeNull();
    expect(
      readSavedDraft(
        { ...body, result: { ...result, versionId: newerId } },
        { ...result, newRevision: true },
      ),
    ).toEqual({ ...result, versionId: newerId });
    expect(readSavedDraft(body, { ...result, exerciseId: '12' })).toBeNull();
    expect(readSavedDraft(body, { ...result, versionId: newerId })).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    {
      result: {
        exerciseId: '12',
        versionId: '9a000000-0000-0000-0000-000000000001',
      },
    },
    {
      environment: 'production',
      result: {
        exerciseId: '12',
        versionId: '9a000000-0000-0000-0000-000000000001',
      },
    },
    { environment: 'staging', result: null },
    { environment: 'staging', result: [] },
    {
      environment: 'staging',
      result: {
        exerciseId: 12,
        versionId: '9a000000-0000-0000-0000-000000000001',
      },
    },
    {
      environment: 'staging',
      result: {
        exerciseId: '9223372036854775808',
        versionId: '9a000000-0000-0000-0000-000000000001',
      },
    },
    {
      environment: 'staging',
      result: { exerciseId: '12', versionId: '../../another-page' },
    },
  ])(
    'ne déduit aucun succès d’un HTTP 200 au corps incompatible %#',
    (body) => {
      expect(readSavedDraft(body, {})).toBeNull();
    },
  );
  it('conserve les bigint sans perte de précision et rejette les identifiants SQL arbitraires', () => {
    expect(isExerciseId('9007199254740993')).toBe(true);
    expect(isExerciseId('9223372036854775807')).toBe(true);
    for (const id of [
      '0',
      '-1',
      '1 OR true',
      '9223372036854775808',
      '1.0',
      '01',
      1,
    ])
      expect(isExerciseId(id)).toBe(false);
    expect(isUuid('9A000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isUuid('other-user/../../../')).toBe(false);
  });
  it('borne les filtres et écarte les tris et statuts arbitraires', () => {
    expect(
      catalogueFilter(
        new URLSearchParams('page=-1&status=admin&sort=sql&q=%20abc%20'),
      ),
    ).toEqual({ query: 'abc', status: 'all', sort: 'recent', page: 1 });
    expect(
      catalogueFilter(new URLSearchParams('status=archived&sort=title&page=2'))
        .page,
    ).toBe(2);
    expect(
      catalogueFilter(new URLSearchParams({ q: 'a'.repeat(200) })).query,
    ).toHaveLength(120);
  });
  it('prépare le schéma Engine 5, sans inventer un exercice historique ni des attendus', () => {
    const definition = newDraft('Nouveau brouillon');
    expect(draftEnvelope(definition)).toBe(true);
    expect(definition.schemaVersion).toBe(5);
    expect(definition.elements).toEqual([]);
    expect(draftEnvelope({ ...definition, schemaVersion: 4 })).toBe(false);
    expect(draftEnvelope({ ...definition, title: '' })).toBe(false);
    expect(draftEnvelope({ ...definition, generation: {} })).toBe(false);
    expect(draftEnvelope({ ...definition, variables: [null] })).toBe(false);
    expect(draftEnvelope({ ...definition, elements: [null] })).toBe(false);
    expect(
      draftEnvelope({ ...definition, elements: Array(101).fill({}) }),
    ).toBe(false);
  });
  it('compare la structure sans traiter deux expressions comme mathématiquement équivalentes', () => {
    const before = {
      title: 'Avant',
      elements: [{ latex: 'x+x' }],
      catalogue: { 'a/b': 1 },
    };
    const after = {
      title: 'Après',
      elements: [{ latex: '2x' }],
      catalogue: { 'a/b': 2 },
    };
    const changes = revisionDiff(before, after);
    expect(changes.map((change) => change.path)).toEqual([
      '/catalogue/a~1b',
      '/elements',
      '/title',
    ]);
    expect(before.elements[0].latex).toBe('x+x');
    expect(revisionDiff({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });
});
describe('lecture JSON bornée', () => {
  it('accepte les octets UTF-8 réels', async () => {
    expect(
      await readBoundedJson(
        new Request('http://localhost', {
          method: 'POST',
          body: '{"title":"Équation"}',
        }),
      ),
    ).toEqual({ title: 'Équation' });
  });
  it('rejette un corps chunked même si Content-Length ment', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(' '.repeat(100)));
        controller.close();
      },
    });
    const request = new Request('http://localhost', {
      method: 'POST',
      body: stream,
      duplex: 'half',
      headers: { 'content-length': '1' },
    } as RequestInit);
    await expect(readBoundedJson(request, 20)).rejects.toThrow('input-limit');
  });
  it('rejette les UTF-8 et JSON invalides', async () => {
    await expect(
      readBoundedJson(
        new Request('http://localhost', {
          method: 'POST',
          body: new Uint8Array([255]),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      readBoundedJson(
        new Request('http://localhost', { method: 'POST', body: '{' }),
      ),
    ).rejects.toThrow();
  });
});
