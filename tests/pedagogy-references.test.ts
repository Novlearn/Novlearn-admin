import { expect, it } from 'vitest';
import {
  decodePedagogyReferences,
  readPedagogyReferenceQuery,
  readPedagogyPageQuery,
} from '@/lib/pedagogy-references';
const id = 'ab200000-0000-4000-8000-000000000001';
const query = { kind: 'chapter' as const, q: '%_\\' };
const fixture = () => ({
  schemaVersion: 1,
  environment: 'local-copy',
  kind: 'chapter',
  q: '%_\\',
  more: false,
  items: [{ id, label: 'Métadonnées %_\\', truncated: false }],
});
it('preserves literal wildcard characters in a bounded metadata search', () => {
  expect(readPedagogyReferenceQuery(new URLSearchParams(query))).toEqual({
    ok: true,
    query,
  });
  expect(
    decodePedagogyReferences(fixture(), { environment: 'local-copy', query }),
  ).toEqual(fixture());
});
it.each([
  'kind=user',
  'kind=chapter&kind=competence',
  'kind=chapter&q=a&q=b',
  'kind=chapter&source=production',
  'kind=chapter&q=%00',
  'kind=chapter&q=%0A',
  'kind=chapter&q=' + encodeURIComponent('😀'.repeat(201)),
])('refuses an invalid reference query %s', (q) =>
  expect(readPedagogyReferenceQuery(new URLSearchParams(q)).ok).toBe(false),
);
it.each(['source', 'rawUser', 'definition', 'email'])(
  'rejects unsolicited projection fields %s',
  (key) =>
    expect(
      decodePedagogyReferences(
        { ...fixture(), [key]: 'private' },
        { environment: 'local-copy', query },
      ),
    ).toBeNull(),
);
it('does not relabel a local copy as Production', () =>
  expect(
    decodePedagogyReferences(fixture(), { environment: 'production', query }),
  ).toBeNull());
it('rejects mismatched terms, IDs, duplicates and false truncation metadata', () => {
  const v = fixture();
  v.q = 'other';
  expect(
    decodePedagogyReferences(v, { environment: 'local-copy', query }),
  ).toBeNull();
  const w = fixture();
  w.items.push({ ...w.items[0] });
  expect(
    decodePedagogyReferences(w, { environment: 'local-copy', query }),
  ).toBeNull();
  const x = fixture();
  x.items[0].id = 'not-a-uuid';
  expect(
    decodePedagogyReferences(x, { environment: 'local-copy', query }),
  ).toBeNull();
  const y = fixture();
  y.more = true;
  expect(
    decodePedagogyReferences(y, { environment: 'local-copy', query }),
  ).toBeNull();
});
it('keeps page-only reference searches out of the aggregate query contract', () => {
  const p = readPedagogyPageQuery(
    new URLSearchParams(
      'from=2026-10-15&to=2026-10-17&chapterSearch=needle&competenceSearch=skill',
    ),
  );
  expect(p.ok).toBe(true);
  if (!p.ok) return;
  expect(p.chapterSearch).toBe('needle');
  expect(p.competenceSearch).toBe('skill');
  expect(Object.keys(p.query)).not.toContain('chapterSearch');
});
it.each([
  'chapterSearch=a&chapterSearch=b',
  'competenceSearch=%0A',
  'source=production',
  'chapterSearch=' + encodeURIComponent('x'.repeat(201)),
])('refuses ambiguous page filters %s', (q) =>
  expect(readPedagogyPageQuery(new URLSearchParams(q)).ok).toBe(false),
);
