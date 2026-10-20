import { expect, it } from 'vitest';
import {
  activeVersionState,
  compareActiveVersion,
  decodeActiveVersionSnapshot,
  type ActiveVersionSnapshot,
  type ComparableVersion,
} from '@/lib/active-version';
const catalogId = 'ad100000-0000-4000-8000-000000000001',
  versionId = 'ad200000-0000-4000-8000-000000000001';
const expected = {
  environment: 'local-copy' as const,
  targetKey: 'local-http-fixture',
  catalogId,
};
const fixture = (): ActiveVersionSnapshot => ({
  schemaVersion: 1,
  ...expected,
  asOf: '2026-10-19T18:00:00.000001Z',
  parent: {
    exerciseId: '9007199254740993',
    catalogId,
    activeVersionId: versionId,
    publicationEpoch: '9007199254740995',
    archivedAt: null,
  },
  active: {
    versionId,
    exerciseId: '9007199254740993',
    revision: 2,
    status: 'published',
    publishedAt: '2026-10-18T10:00:00Z',
    definitionSha256: 'a'.repeat(64),
    engineContract: 'schema-5;engine-0.1.0',
    generationVersion: 'mulberry32-rejection-v1',
    canonicalizationVersion: 'pg-jsonb-text-v1',
  },
});
const selected = (s = fixture()): ComparableVersion => {
  const v = s.active!;
  return {
    revision: v.revision,
    definitionSha256: v.definitionSha256,
    engineContract: v.engineContract,
    generationVersion: v.generationVersion,
    canonicalizationVersion: v.canonicalizationVersion,
  };
};
it('decodes only expected source metadata and keeps exact bigint identities', () => {
  const v = fixture(),
    d = decodeActiveVersionSnapshot(v, expected);
  expect(d).toEqual(v);
  expect(d).not.toBe(v);
  expect(d!.parent!.exerciseId).toBe('9007199254740993');
  expect(d!.parent!.publicationEpoch).toBe('9007199254740995');
  expect(activeVersionState(d!)).toEqual({ state: 'active', issue: null });
});
it.each(['definition', 'content', 'answer', 'email', 'profile', 'secret'])(
  'rejects unsolicited projection field %s',
  (key) => {
    for (const target of ['top', 'parent', 'active']) {
      const v = fixture();
      Object.assign(
        target === 'top' ? v : target === 'parent' ? v.parent! : v.active!,
        { [key]: 'private' },
      );
      expect(decodeActiveVersionSnapshot(v, expected)).toBeNull();
    }
  },
);
it('does not relabel a source or target identity', () => {
  for (const change of [
    { environment: 'production' },
    { targetKey: 'production-' + 'a'.repeat(20) },
    { catalogId: 'ad100000-0000-4000-8000-000000000002' },
  ])
    expect(
      decodeActiveVersionSnapshot({ ...fixture(), ...change }, expected),
    ).toBeNull();
  const v = fixture();
  v.parent!.catalogId = 'ad100000-0000-4000-8000-000000000002';
  expect(decodeActiveVersionSnapshot(v, expected)).toBeNull();
});
it('accepts operational metadata only with its exact expected operational source label', () => {
  const e = {
    ...expected,
    environment: 'production' as const,
    targetKey: 'production-' + 'a'.repeat(20),
  };
  expect(decodeActiveVersionSnapshot({ ...fixture(), ...e }, e)).not.toBeNull();
  expect(decodeActiveVersionSnapshot(fixture(), e)).toBeNull();
});
it.each([
  '2026-02-30T12:00:00Z',
  '2026-10-19T18:00:00.0000001Z',
  '2026-10-19',
  'not-a-time',
])('rejects malformed timestamps %s', (asOf) =>
  expect(
    decodeActiveVersionSnapshot({ ...fixture(), asOf }, expected),
  ).toBeNull(),
);
it('distinguishes absent catalogue identity, no active pointer and a hidden/broken active row', () => {
  const absent = { ...fixture(), parent: null, active: null };
  expect(decodeActiveVersionSnapshot(absent, expected)).not.toBeNull();
  expect(activeVersionState(absent).state).toBe('absent');
  const unpublished = fixture();
  unpublished.parent!.activeVersionId = null;
  unpublished.active = null;
  expect(decodeActiveVersionSnapshot(unpublished, expected)).not.toBeNull();
  expect(activeVersionState(unpublished).state).toBe('unpublished');
  const missing = fixture();
  missing.active = null;
  expect(decodeActiveVersionSnapshot(missing, expected)).not.toBeNull();
  expect(activeVersionState(missing)).toEqual({
    state: 'inconsistent',
    issue: 'missing-version',
  });
});
it.each([
  [
    'pointer-mismatch',
    (v: ActiveVersionSnapshot) => {
      v.active!.versionId = 'ad200000-0000-4000-8000-000000000002';
    },
  ],
  [
    'wrong-parent',
    (v: ActiveVersionSnapshot) => {
      v.active!.exerciseId = '42';
    },
  ],
  [
    'not-published',
    (v: ActiveVersionSnapshot) => {
      v.active!.status = 'approved';
    },
  ],
  [
    'missing-publication-time',
    (v: ActiveVersionSnapshot) => {
      v.active!.publishedAt = null;
    },
  ],
  [
    'future-publication-time',
    (v: ActiveVersionSnapshot) => {
      v.active!.publishedAt = '2026-10-19T18:00:00.000002Z';
    },
  ],
  [
    'future-archive',
    (v: ActiveVersionSnapshot) => {
      v.parent!.archivedAt = '2026-10-19T18:00:00.000002Z';
    },
  ],
] as const)(
  'reports %s instead of asserting an absent publication',
  (issue, change) => {
    const v = fixture();
    change(v);
    expect(decodeActiveVersionSnapshot(v, expected)).not.toBeNull();
    expect(activeVersionState(v)).toEqual({ state: 'inconsistent', issue });
    expect(compareActiveVersion(v, selected())).toBe('not-comparable');
  },
);
it('compares publication time at the exact microsecond boundary', () => {
  const v = fixture();
  v.active!.publishedAt = v.asOf;
  expect(activeVersionState(v).state).toBe('active');
  v.active!.publishedAt = '2026-10-19T18:00:00.000002Z';
  expect(activeVersionState(v).state).toBe('inconsistent');
});
it('retains an archived target flag without inventing a different active pointer', () => {
  const v = fixture();
  v.parent!.archivedAt = '2026-10-19T17:00:00Z';
  expect(activeVersionState(v).state).toBe('active');
  expect(v.parent!.activeVersionId).toBe(versionId);
});
it('compares immutable revision metadata rather than unrelated source/target row IDs', () => {
  expect(compareActiveVersion(fixture(), selected())).toBe('same-version');
  expect(compareActiveVersion(fixture(), { ...selected(), revision: 1 })).toBe(
    'different-revision',
  );
  for (const key of [
    'definitionSha256',
    'engineContract',
    'generationVersion',
    'canonicalizationVersion',
  ] as const) {
    const s = selected();
    s[key] = key === 'definitionSha256' ? 'b'.repeat(64) : 'different';
    expect(compareActiveVersion(fixture(), s)).toBe('different-content');
  }
  expect(compareActiveVersion(fixture(), null)).toBe('not-comparable');
});
it.each(['-0', '01', '9223372036854775808', '-9223372036854775809', '1.1'])(
  'rejects malformed or overflowing bigint values %s',
  (bad) => {
    const p = fixture();
    p.parent!.exerciseId = bad;
    expect(decodeActiveVersionSnapshot(p, expected)).toBeNull();
    const e = fixture();
    e.parent!.publicationEpoch = bad;
    expect(decodeActiveVersionSnapshot(e, expected)).toBeNull();
  },
);
it('keeps signed internal IDs within PostgreSQL bounds without rounding', () => {
  const v = fixture();
  v.parent!.exerciseId = '-9223372036854775808';
  v.active!.exerciseId = v.parent!.exerciseId;
  v.parent!.publicationEpoch = '9223372036854775807';
  expect(decodeActiveVersionSnapshot(v, expected)).not.toBeNull();
});
it('rejects impossible envelope associations and malformed hashes/contracts', () => {
  expect(
    decodeActiveVersionSnapshot({ ...fixture(), parent: null }, expected),
  ).toBeNull();
  const p = fixture();
  p.parent!.activeVersionId = null;
  expect(decodeActiveVersionSnapshot(p, expected)).toBeNull();
  for (const change of [
    { definitionSha256: 'f'.repeat(63) },
    { engineContract: 'bad\ncontract' },
    { revision: 0 },
    { revision: 2147483648 },
    { status: 'archived' },
  ]) {
    const v = fixture();
    Object.assign(v.active!, change);
    expect(decodeActiveVersionSnapshot(v, expected)).toBeNull();
  }
});
