import { describe, expect, it } from 'vitest';
import {
  readStagingExportSource,
  stagingDumpArguments,
  redactExportError,
  STAGING_EXPORT_HOST,
  managedAuthTriggerSql,
} from '../scripts/export-staging-schema';

const valid = () => ({
  host: STAGING_EXPORT_HOST,
  port: 5432,
  database: 'postgres',
  user: 'schema_reader',
  password: 'Only-a-test:#$\\"password',
});
describe('triggers applicatifs sur auth.users', () => {
  const row = {
    name: 'on_auth_user_created',
    enabled: 'O',
    definition:
      'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()',
  };
  it.each([
    ['O', 'ENABLE'],
    ['D', 'DISABLE'],
    ['R', 'ENABLE REPLICA'],
    ['A', 'ENABLE ALWAYS'],
  ])(
    'conserve le mode %s sans réactiver implicitement un trigger',
    (enabled, mode) => {
      expect(managedAuthTriggerSql([{ ...row, enabled }])).toBe(
        `${row.definition};\nALTER TABLE ONLY "auth"."users" ${mode} TRIGGER "on_auth_user_created";\n`,
      );
    },
  );
  it('cite le nom du trigger et accepte une liste vide', () => {
    expect(
      managedAuthTriggerSql([{ ...row, name: 'quoted"; name' }]),
    ).toContain('TRIGGER "quoted""; name";');
    expect(managedAuthTriggerSql([])).toBe('');
  });
  it.each([
    null,
    {},
    [null],
    [[]],
    [{ ...row, name: '' }],
    [{ ...row, name: 'invalid\0name' }],
    [{ ...row, enabled: 'unknown' }],
    [{ ...row, enabled: 'toString' }],
    [{ ...row, enabled: null }],
    [{ ...row, definition: null }],
    [{ ...row, definition: '' }],
    [{ ...row, definition: 'DROP TABLE auth.users' }],
    [{ ...row, definition: row.definition + '\0' }],
    [row, row],
  ])('refuse des métadonnées incomplètes ou inconnues %j', (rows) => {
    expect(() => managedAuthTriggerSql(rows)).toThrow(
      'Métadonnées de trigger invalides.',
    );
  });
});
describe('source d’export Staging uniquement', () => {
  it('accepte une configuration explicite sans la partager par référence', () => {
    const input = valid();
    const parsed = readStagingExportSource(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(
      readStagingExportSource({ ...input, caFile: 'supabase-ca.crt' }),
    ).toEqual({
      ...input,
      caFile: 'supabase-ca.crt',
    });
  });
  it.each([
    ['host', 'db.abwipnppcrghdhwriyjp.supabase.co'],
    ['host', '127.0.0.1'],
    ['host', STAGING_EXPORT_HOST + '.example.test'],
    ['host', STAGING_EXPORT_HOST + '.'],
    ['host', STAGING_EXPORT_HOST.toUpperCase()],
    ['port', 6543],
    ['port', '5432'],
    ['database', 'another_database'],
    ['user', ''],
    ['user', 'other\nPGHOST=production'],
    ['user', 'schema_reader; SET ROLE postgres'],
    ['user', 'a'.repeat(64)],
    ['password', ''],
    ['password', 'short'],
    ['password', 'p'.repeat(513)],
    ['password', 'a-password\nPGHOST=production'],
    ['password', 'a-password\rPGHOST=production'],
    ['password', 'a-password\0'],
    ['caFile', '../other.crt'],
    ['caFile', 'C:/another/private.key'],
    ['ssl', false],
    ['options', '-c default_transaction_read_only=off'],
    ['schema', 'auth'],
  ])('refuse le remplacement de %s sans exposer le secret', (key, value) => {
    const input = { ...valid(), [key]: value };
    expect(() => readStagingExportSource(input)).toThrow(
      'Configuration privée Staging invalide.',
    );
    try {
      readStagingExportSource(input);
    } catch (error) {
      expect(String(error)).toBe(
        'Error: Configuration privée Staging invalide.',
      );
    }
  });
  it.each([
    null,
    [],
    'postgresql://example',
    {},
    { ...valid(), password: 123 },
  ])('refuse une forme invalide %j', (value) =>
    expect(() => readStagingExportSource(value)).toThrow(),
  );
  it.each(['host', 'port', 'database', 'user', 'password'])(
    'exige le champ %s et ne choisit pas un défaut ambiant',
    (key) => {
      const input: Record<string, unknown> = valid();
      delete input[key];
      expect(() => readStagingExportSource(input)).toThrow();
    },
  );
});
describe('contrat du dump', () => {
  it('conserve schéma seul, snapshot et ACL sans nettoyage ou données', () => {
    const args = stagingDumpArguments('00000003-0000001B-1', [
      'novlearn_admin_private',
      'public',
    ]);
    for (const flag of [
      '--schema-only',
      '--no-password',
      '--no-publications',
      '--no-subscriptions',
      '--snapshot=00000003-0000001B-1',
      '--schema=public',
      '--schema=novlearn_admin_private',
    ])
      expect(args).toContain(flag);
    for (const forbidden of [
      '--clean',
      '--create',
      '--data-only',
      '--inserts',
      '--no-owner',
      '--no-privileges',
      '--role',
    ])
      expect(args).not.toContain(forbidden);
    expect(args.join(' ')).not.toContain(valid().password);
    expect(stagingDumpArguments('00000003-0000001B-1', ['public'])).toContain(
      '--schema=public',
    );
  });
  it.each([
    ['', ['public']],
    ['00000003-0000001B-1;--data-only', ['public']],
    ['00000003-0000001B-1', []],
    ['00000003-0000001B-1', ['auth']],
    ['00000003-0000001B-1', ['public', 'auth']],
    ['00000003-0000001B-1', ['novlearn_admin_private']],
    ['00000003-0000001B-1', ['public', 'public']],
  ] as [string, string[]][])(
    'refuse le snapshot/schéma %s %j',
    (id, schemas) => {
      expect(() => stagingDumpArguments(id, schemas)).toThrow();
    },
  );
});
it('expurge la forme brute et encodée du secret des erreurs', () => {
  const password = valid().password;
  const result = redactExportError(
    new Error('Failed: ' + password + ' ' + encodeURIComponent(password)),
    password,
  );
  expect(result).toBe('Failed: [secret] [secret]');
  expect(redactExportError('No confidential value', password)).toBe(
    'No confidential value',
  );
});
