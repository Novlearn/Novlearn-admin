import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  make: vi.fn(),
  identity: vi.fn(),
  bound: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  clientOn: vi.fn(),
  clientOff: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: vi.fn(function (config: unknown) {
    fake.make(config);
    return {
      connect: async () => ({
        query: fake.query,
        release: fake.release,
        on: fake.clientOn,
        removeListener: fake.clientOff,
      }),
      end: fake.end,
      on: fake.on,
    };
  }),
}));
import {
  createPublicationPgPools,
  readPublicationPgConfiguration,
  type PublicationPgConfiguration,
} from '@/lib/publication-pg';
const target = 'abcdefghijklmnopqrst',
  sourceRole = 'novlearn_publication_journal_executor',
  targetRole = 'novlearn_publication_executor';
const sourceLogin = 'novlearn_admin_journal_service',
  targetLogin = 'novlearn_admin_publication_service';
const sourceUrl = `postgresql://${sourceLogin}:synthetic-source-password@db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres`;
const targetUrl = `postgresql://${targetLogin}:synthetic-target-password@db.${target}.supabase.co:5432/postgres`;
const env = () => ({
  ADMIN_STAGING_AUTH_ENABLED: 'true',
  ADMIN_STAGING_SECURITY_REVIEW: 'synthetic auth review',
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test',
  APP_BASE_URL: 'http://localhost:3000',
  ADMIN_PUBLICATION_ENABLED: 'true',
  ADMIN_PUBLICATION_SECURITY_REVIEW: 'synthetic publication review',
  ADMIN_PUBLICATION_TARGET_PROJECT_REF: target,
  ADMIN_PUBLICATION_SOURCE_PG_URL: sourceUrl,
  ADMIN_PUBLICATION_TARGET_PG_URL: targetUrl,
});
const config = (): PublicationPgConfiguration => ({
  source: { url: sourceUrl },
  target: { url: targetUrl },
  targetKey: `production-${target}`,
  review: 'synthetic',
});
const roleData = () => ({
  rolcanlogin: false,
  rolinherit: false,
  rolsuper: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  rolbypassrls: false,
  memberships: [],
});
const identity = (role: string) => ({
  ...roleData(),
  login: role === sourceRole ? sourceLogin : targetLogin,
  rolcanlogin: true,
  memberships: [role],
  membership_safe: true,
  database_create: false,
  schema_create: false,
  capability: roleData(),
});
beforeEach(() => {
  fake.identity.mockImplementation(identity);
  fake.bound.mockImplementation((role) => role);
  let role = sourceRole;
  fake.query.mockImplementation(async (sql: string, values?: unknown[]) => {
    if (sql.includes('r.rolname AS login')) {
      role = String(values?.[0]);
      return { rows: [fake.identity(role)] };
    }
    if (sql === 'SELECT current_user AS role')
      return { rows: [{ role: fake.bound(role) }] };
    return { rows: [] };
  });
});
describe('Publication : configuration fermée et séparation', () => {
  it('does not construct pools while only reading valid operator configuration', () => {
    expect(readPublicationPgConfiguration(env())?.targetKey).toBe(
      `production-${target}`,
    );
    expect(fake.make).not.toHaveBeenCalled();
  });
  it.each([
    { ADMIN_PUBLICATION_ENABLED: undefined },
    { ADMIN_PUBLICATION_SECURITY_REVIEW: '' },
    { ADMIN_STAGING_AUTH_ENABLED: 'false' },
    { ADMIN_STAGING_SECURITY_REVIEW: '' },
    { ADMIN_PUBLICATION_TARGET_PROJECT_REF: STAGING_PROJECT_REF },
    { ADMIN_PUBLICATION_TARGET_PROJECT_REF: 'wrong' },
  ])('refuses incomplete approval or environment %j', (change) =>
    expect(readPublicationPgConfiguration({ ...env(), ...change })).toBeNull(),
  );
  it.each([
    sourceUrl + '?sslmode=disable',
    sourceUrl + '?sslrootcert=other',
    sourceUrl.replace(':5432', ':6543'),
    sourceUrl.replace('/postgres', '/another_database'),
    sourceUrl.replace(sourceLogin, 'postgres'),
    sourceUrl.replace(
      `db.${STAGING_PROJECT_REF}.supabase.co`,
      'db.other.supabase.co',
    ),
    sourceUrl.replace('synthetic-source-password', 'short'),
    'not a URL',
  ])('refuses unsafe source URL %#', (url) =>
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_SOURCE_PG_URL: url,
      }),
    ).toBeNull(),
  );
  it('refuses swapped targets and reused credentials', () => {
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_TARGET_PG_URL: sourceUrl,
      }),
    ).toBeNull();
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_TARGET_PG_URL: targetUrl.replace(
          'synthetic-target-password',
          'synthetic-source-password',
        ),
      }),
    ).toBeNull();
  });
  it('rejects the same credential hidden behind different URL encoding', () => {
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_TARGET_PG_URL: targetUrl.replace(
          'synthetic-target-password',
          '%73ynthetic-source-password',
        ),
      }),
    ).toBeNull();
  });
  it('binds the private destination key to the configured project and its default database', () => {
    const other = 'z'.repeat(20);
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_TARGET_PG_URL: targetUrl.replace(
          '/postgres',
          '/another_database',
        ),
      }),
    ).toBeNull();
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_TARGET_PROJECT_REF: other,
        ADMIN_PUBLICATION_TARGET_PG_URL: targetUrl.replace(target, other),
      })?.targetKey,
    ).toBe(`production-${other}`);
  });
  it('accepts optional trusted CA text but never URL SSL overrides', () => {
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_SOURCE_PG_CA: 'invalid',
      }),
    ).toBeNull();
    expect(
      readPublicationPgConfiguration({
        ...env(),
        ADMIN_PUBLICATION_SOURCE_PG_CA:
          '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
      })?.source.ca,
    ).toContain('BEGIN CERTIFICATE');
  });
});
describe('Pilote : TLS et rôles bornés', () => {
  it('creates separate lazy pools with strict TLS despite ambient SSL mode', () => {
    vi.stubEnv('PGSSLMODE', 'disable');
    createPublicationPgPools(config());
    expect(fake.make).toHaveBeenCalledTimes(2);
    expect(fake.query).not.toHaveBeenCalled();
    expect(fake.make.mock.calls[0][0]).toMatchObject({
      max: 4,
      connectionTimeoutMillis: 3000,
      ssl: { rejectUnauthorized: true },
      enableChannelBinding: true,
    });
    expect(fake.make.mock.calls[1][0]).toMatchObject({
      max: 2,
      ssl: { rejectUnauthorized: true },
    });
  });
  it('checks source identity and discards prior session state before binding role', async () => {
    const pools = createPublicationPgPools(config());
    const connection = await pools.source();
    expect(fake.query.mock.calls[0][0]).toBe('DISCARD ALL');
    expect(fake.query.mock.calls[1][0]).toBe("SET search_path=''");
    expect(fake.query.mock.calls[2][1]).toEqual([sourceRole]);
    expect(fake.query).toHaveBeenCalledWith(
      'SET ROLE novlearn_publication_journal_executor',
    );
    connection.release();
    await pools.close();
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.end).toHaveBeenCalledTimes(2);
  });
  it('binds target to its own capability, never source role', async () => {
    const pools = createPublicationPgPools(config());
    (await pools.target()).release();
    expect(fake.query).toHaveBeenCalledWith(
      'SET ROLE novlearn_publication_executor',
    );
    expect(fake.query.mock.calls[2][1]).toEqual([targetRole]);
  });
  it('handles a leased-client transport error and destroys that connection on release', async () => {
    const connection = await createPublicationPgPools(config()).source();
    const handler = fake.clientOn.mock.calls.find(
      ([event]) => event === 'error',
    )![1] as () => void;
    expect(() => handler()).not.toThrow();
    connection.release();
    expect(fake.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(fake.clientOff).toHaveBeenCalledWith('error', handler);
  });
  it.each([
    'rolinherit',
    'rolsuper',
    'rolcreatedb',
    'rolcreaterole',
    'rolreplication',
    'rolbypassrls',
    'database_create',
    'schema_create',
  ])('destroys a login connection with excessive %s', async (field) => {
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      [field]: true,
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow(
      'Publication backend unavailable',
    );
    expect(fake.release).toHaveBeenCalledWith(true);
  });
  it.each([
    'rolcanlogin',
    'rolinherit',
    'rolsuper',
    'rolcreatedb',
    'rolcreaterole',
    'rolreplication',
    'rolbypassrls',
  ])('refuses drifted capability attribute %s', async (field) => {
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      capability: { ...roleData(), [field]: true },
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow(
      'Publication backend unavailable',
    );
    expect(fake.release).toHaveBeenCalledWith(true);
  });
  it('refuses extra memberships on login or capability', async () => {
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      memberships: [role, 'other_role'],
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow();
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      capability: { ...roleData(), memberships: ['other_role'] },
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow();
  });
  it('refuses delegation, implicit inheritance or missing SET permission on the membership', async () => {
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      membership_safe: false,
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow(
      'Publication backend unavailable',
    );
    expect(fake.release).toHaveBeenCalledWith(true);
  });
  it('refuses unexpected current user or role after binding', async () => {
    fake.identity.mockImplementation((role) => ({
      ...identity(role),
      login: 'postgres',
    }));
    await expect(createPublicationPgPools(config()).source()).rejects.toThrow();
    fake.identity.mockImplementation(identity);
    fake.bound.mockReturnValue('other_role');
    await expect(createPublicationPgPools(config()).target()).rejects.toThrow();
  });
  it('masks connection errors and rejects invalid trusted URLs without echoing credentials', async () => {
    fake.query.mockRejectedValue(Error('PRIVATE_CONNECTION_DETAILS'));
    await expect(
      createPublicationPgPools(config()).source(),
    ).rejects.toMatchObject({ message: 'Publication backend unavailable' });
    expect(() =>
      createPublicationPgPools({
        ...config(),
        source: { url: 'PRIVATE_INVALID_URL' },
      }),
    ).toThrow('Publication backend unavailable');
  });
  it('masks invalid percent encoding in trusted credentials before constructing a pool', () => {
    expect(() =>
      createPublicationPgPools({
        ...config(),
        source: { url: sourceUrl.replace(sourceLogin, '%zz') },
      }),
    ).toThrow('Publication backend unavailable');
    expect(fake.make).not.toHaveBeenCalled();
  });
});
