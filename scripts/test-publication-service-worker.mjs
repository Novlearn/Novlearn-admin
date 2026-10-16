// Fixed experiments, private local Docker only. Real PostgreSQL and Engine;
// identity and the Supabase HTTP transport are explicitly synthetic.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
let context;
async function setup() {
  if (context) return context;
  const api = await import('/fixture/bundle/native.mjs');
  const { config, actor, session, confirmationKey } = JSON.parse(
    await readFile('/fixture/client.json', 'utf8'),
  );
  assert(session && confirmationKey);
  const { source: original } = JSON.parse(
    await readFile('/fixture/target-input.json', 'utf8'),
  );
  const cgroup = {
    memoryMax: (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim(),
    swapMax: (await readFile('/sys/fs/cgroup/memory.swap.max', 'utf8')).trim(),
    pidsMax: (await readFile('/sys/fs/cgroup/pids.max', 'utf8')).trim(),
    uid: process.getuid(),
    platform: process.platform,
    architecture: process.arch,
  };
  assert.deepEqual(cgroup, {
    memoryMax: '402653184',
    swapMax: '0',
    pidsMax: '64',
    uid: 65534,
    platform: 'linux',
    architecture: 'x64',
  });
  async function sessionQuery(
    text,
    values = [],
    database = 'transfer_source',
    commit = false,
  ) {
    const sessionUrl = new URL(session.url);
    sessionUrl.pathname = '/' + database;
    const client = new Client({
      connectionString: sessionUrl.href,
      ssl: { ca: session.ca, rejectUnauthorized: true },
      enableChannelBinding: true,
      connectionTimeoutMillis: 3000,
      query_timeout: 10000,
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [actor, JSON.stringify({ sub: actor, is_anonymous: false })],
      );
      const result = await client.query(text, values);
      if (commit) await client.query('COMMIT');
      return result;
    } finally {
      try {
        await client.query('ROLLBACK');
      } finally {
        await client.end();
      }
    }
  }
  let roundtrips = 0,
    checks = 0;
  const verificationFacts = [];
  const sessionClient = createClient(
    'https://synthetic-session.invalid',
    'sb_publishable_local_fixture',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, options) => {
          options?.signal?.throwIfAborted();
          const url = new URL(String(input));
          let data;
          if (url.pathname === '/rest/v1/exercise_versions') {
            assert.equal(url.searchParams.get('select'), 'id,definition');
            assert.equal(
              url.searchParams.get('id'),
              'eq.' + original.version_id,
            );
            data =
              (
                await sessionQuery(
                  'SELECT id,definition FROM public.exercise_versions WHERE id=$1::uuid',
                  [original.version_id],
                )
              ).rows[0] ?? null;
          } else {
            assert.equal(
              url.pathname,
              '/rest/v1/rpc/admin_export_exercise_publication',
            );
            const p = JSON.parse(options.body);
            assert.deepEqual(Object.keys(p).sort(), [
              'p_epoch',
              'p_fingerprint',
              'p_roundtrip_definition',
              'p_version_id',
            ]);
            data = (
              await sessionQuery(
                'SELECT public.admin_export_exercise_publication($1::uuid,$2::text,$3::bigint,$4::jsonb) AS exported',
                [
                  p.p_version_id,
                  p.p_fingerprint,
                  p.p_epoch,
                  JSON.stringify(p.p_roundtrip_definition),
                ],
              )
            ).rows[0].exported;
            roundtrips++;
          }
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    },
  );
  const auth = {
    getVerifiedUser: async () => ({ id: actor, isAnonymous: false }),
    getProfileRole: async () =>
      (
        await sessionQuery(
          'SELECT role FROM public.profiles WHERE id=$1::uuid',
          [actor],
        )
      ).rows[0]?.role ?? null,
  };
  const clients = [];
  const make = (database, key, loss = false, options = {}) => {
    const sourceUrl = new URL(config.source.url);
    sourceUrl.pathname = '/' + (options.sourceDatabase ?? 'transfer_source');
    const targetUrl = new URL(config.target.url);
    targetUrl.pathname = '/' + database;
    const pools = api.createPublicationPgPools({
      ...config,
      source: { ...config.source, url: sourceUrl.href },
      target: { ...config.target, url: targetUrl.href },
      targetKey: key,
    });
    clients.push(pools);
    let calls = 0,
      targetRecordTime = null;
    const target = new api.PublicationTarget(async () => {
      const connection = await pools.target();
      return {
        query: async (text, values) => {
          if (text.includes('public.apply_exercise_publication')) calls++;
          if (loss === 'before' && text === 'COMMIT')
            throw Error('Fixture loss before sending commit');
          const applying = text.includes('public.apply_exercise_publication');
          const result = await connection.query(
            applying
              ? text + ', transaction_timestamp()::text AS fixture_target_time'
              : text,
            values,
          );
          if (applying)
            targetRecordTime = result.rows[0]?.fixture_target_time ?? null;
          if (loss && text === 'COMMIT')
            throw Error('Fixture lost acknowledgement after real commit');
          return result;
        },
        release: (destroy) => connection.release(destroy),
      };
    }, key);
    const activeAuth = options.authGateway ?? auth;
    let journal,
      sourceRecordTime = null,
      sourceRecordedOutcome = null,
      blocked = false;
    const sourceConnection = async () => {
      const connection = await pools.source();
      return {
        query: async (text, values) => {
          const recording = text.includes(
            'novlearn_admin_private.record_publication_outcome',
          );
          let unblock, held;
          if (recording && options.blockRecord && !blocked) {
            blocked = true;
            let ready;
            const started = new Promise((resolve) => {
              ready = resolve;
            });
            const stop = new Promise((resolve) => {
              unblock = resolve;
            });
            held = journal.withSourceLease(values[0], values[1], async () => {
              ready();
              await stop;
            });
            await Promise.race([
              started,
              held.then(() => {
                throw Error('Source lease ended before contention check');
              }),
            ]);
          }
          try {
            const result = await connection.query(
              recording
                ? text +
                    ', transaction_timestamp()::text AS fixture_source_time'
                : text,
              values,
            );
            if (recording) {
              sourceRecordTime = result.rows[0].fixture_source_time;
              sourceRecordedOutcome = result.rows[0].operation.outcome;
            }
            return result;
          } finally {
            unblock?.();
            if (held) await held;
          }
        },
        release: (destroy) => connection.release(destroy),
      };
    };
    journal = new api.PublicationJournal(activeAuth, sourceConnection);
    const source =
      options.sourceLoader ??
      ((selection, signal) =>
        api.loadPublicationSource(sessionClient, selection, signal));
    const verify = async (value, signal) => {
      checks++;
      const fact = await api.verifyPublicationEngine(value, signal);
      verificationFacts.push(fact);
      return fact;
    };
    const deps = {
      auth: activeAuth,
      journal,
      target,
      targetKey: key,
      confirmationKey: Buffer.from(confirmationKey, 'hex'),
      source,
      verify,
    };
    return {
      service: new api.PublicationService(deps),
      deps,
      calls: () => calls,
      sourceTime: () => sourceRecordTime,
      sourceOutcome: () => sourceRecordedOutcome,
      targetTime: () => targetRecordTime,
    };
  };
  context = {
    api,
    clients,
    make,
    original,
    cgroup,
    verificationFacts,
    checks: () => checks,
    roundtrips: () => roundtrips,
    pending: null,
    sessionQuery,
    sessionMutation: (text, values, database) =>
      sessionQuery(text, values, database, true),
    actor,
  };
  return context;
}
export async function publicationFixture() {
  return setup();
}
export async function runServiceCommand(command) {
  if (command === 'close') {
    if (context) {
      await context.api.closeEngineRuntime();
      for (const pool of context.clients) await pool.close();
    }
    return { closed: true };
  }
  const c = await setup();
  const selection = {
    versionId: c.original.version_id,
    fingerprint: c.original.source_fingerprint,
    epoch: c.original.source_epoch,
  };
  const signal = new AbortController().signal;
  const checksBefore = c.checks(),
    roundtripsBefore = c.roundtrips();
  if (command === 'recoverAfter') {
    assert(c.pending);
    const driver = c.make('service_lost_after', 'local-service-lost');
    const recovered = await driver.service.recover(c.pending.id, signal);
    assert.equal(recovered.state, 'committed');
    assert.equal(recovered.outcome.result, 'unchanged');
    assert.equal(driver.calls(), 0);
    assert.equal(c.checks(), checksBefore);
    return {
      state: recovered.state,
      outcome: recovered.outcome,
      freshEngineChecks: 0,
      applyCalls: 0,
    };
  }
  const lost = command === 'lostAfter';
  const driver = c.make(
    lost ? 'service_lost_after' : 'service_target',
    lost ? 'local-service-lost' : 'local-service',
    lost,
  );
  if (command === 'failedEngine') {
    const bad = new c.api.PublicationService({
      ...driver.deps,
      source: async (...args) => {
        const value = await driver.deps.source(...args);
        value.source.cases[0].answer = { format: 'latex', source: 'a+1' };
        return value;
      },
    });
    await assert.rejects(
      bad.prepare({ ...selection, mode: 'publish' }, signal),
      { code: 'verification' },
    );
    assert.equal(driver.calls(), 0);
    assert.equal(c.checks() - checksBefore, 1);
    return {
      state: 'rejected',
      reason: 'actual Engine case failure',
      freshEngineChecks: 1,
      successfulEngineChecks: 0,
      applyCalls: 0,
    };
  }
  const plan = await driver.service.prepare(
    { ...selection, mode: 'publish' },
    signal,
  );
  assert.equal(plan.operation.state, 'planned');
  assert(!JSON.stringify(plan.operation).includes('PRIVATE_'));
  if (command === 'badConfirmation') {
    const bad =
      plan.confirmation.slice(0, -1) +
      (plan.confirmation.endsWith('a') ? 'b' : 'a');
    await assert.rejects(
      driver.service.confirm(plan.operation.id, bad, signal),
      { code: 'invalid' },
    );
    await driver.service.cancel(plan.operation.id, signal);
    assert.equal(driver.calls(), 0);
    assert.equal(c.checks() - checksBefore, 1);
    return {
      state: 'rejected',
      reason: 'tampered signed confirmation',
      freshEngineChecks: 1,
      applyCalls: 0,
    };
  }
  if (command === 'cancel') {
    const cancelled = await driver.service.cancel(plan.operation.id, signal);
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(driver.calls(), 0);
    return {
      state: 'cancelled',
      freshEngineChecks: c.checks() - checksBefore,
      applyCalls: 0,
    };
  }
  assert(['publish', 'repeat', 'lostAfter'].includes(command));
  const result = await driver.service.confirm(
    plan.operation.id,
    plan.confirmation,
    signal,
  );
  assert.equal(c.checks() - checksBefore, 2);
  assert.equal(driver.calls(), 1);
  assert.equal(c.roundtrips() - roundtripsBefore, 2);
  assert.equal(result.state, lost ? 'uncertain' : 'committed');
  if (!lost)
    assert.equal(
      result.outcome.result,
      command === 'repeat' ? 'unchanged' : 'published',
    );
  else c.pending = result;
  return {
    state: result.state,
    outcome: result.outcome,
    freshEngineChecks: 2,
    sourceSqlExports: 2,
    applyCalls: 1,
    cgroup: c.cgroup,
    verification: c.verificationFacts.slice(-2),
  };
}
