// Actual service/Engine/SQL on dedicated source copies. Auth identity and the
// Supabase HTTP transport remain synthetic; no remote operation is possible.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { publicationFixture } from '/service-worker.mjs';
const pending = new Map();
export async function driverFor(
  database,
  key,
  sourceDatabase,
  loss = false,
  blockRecord = false,
  selectedVersion,
) {
  const fixture = await publicationFixture();
  const versionId = selectedVersion ?? fixture.original.version_id;
  const query = (text, values = []) =>
    fixture.sessionQuery(text, values, sourceDatabase);
  const client = createClient(
    'https://source-fixture.invalid',
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
            assert.equal(url.searchParams.get('id'), 'eq.' + versionId);
            data =
              (
                await query(
                  'SELECT id,definition FROM public.exercise_versions WHERE id=$1::uuid',
                  [versionId],
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
              await query(
                'SELECT public.admin_export_exercise_publication($1::uuid,$2::text,$3::bigint,$4::jsonb) AS exported',
                [
                  p.p_version_id,
                  p.p_fingerprint,
                  p.p_epoch,
                  JSON.stringify(p.p_roundtrip_definition),
                ],
              )
            ).rows[0].exported;
          }
          return new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json' },
          });
        },
      },
    },
  );
  const authGateway = {
    getVerifiedUser: async () => ({ id: fixture.actor, isAnonymous: false }),
    getProfileRole: async () =>
      (
        await query('SELECT role FROM public.profiles WHERE id=$1::uuid', [
          fixture.actor,
        ])
      ).rows[0]?.role ?? null,
  };
  return fixture.make(database, key, loss, {
    sourceDatabase,
    blockRecord,
    authGateway,
    sourceLoader: (selection, signal) =>
      fixture.api.loadPublicationSource(client, selection, signal),
  });
}
export async function runSourceCommand(command) {
  const fixture = await publicationFixture(),
    checksBefore = fixture.checks();
  const signal = new AbortController().signal;
  if (command.startsWith('recover')) {
    const variant =
      command === 'recoverBefore'
        ? 'before'
        : command === 'recoverBlocked'
          ? 'blocked'
          : 'after';
    const prior = pending.get(variant);
    assert(prior);
    const driver = await driverFor(prior.target, prior.key, prior.source);
    let result;
    if (variant === 'after') {
      await assert.rejects(driver.service.recover(prior.operation.id, signal), {
        code: 'forbidden',
      });
      const page = await driver.service.recoverPage();
      assert.deepEqual(page, {
        items: [{ id: prior.operation.id, state: 'committed' }],
        deferred: 0,
        next: null,
      });
      result = {
        id: prior.operation.id,
        state: 'committed',
        outcome: driver.sourceOutcome(),
      };
    } else result = await driver.service.recover(prior.operation.id, signal);
    assert.equal(driver.calls(), 0);
    assert.equal(fixture.checks(), checksBefore);
    assert.equal(result.state, variant === 'before' ? 'failed' : 'committed');
    return {
      state: result.state,
      outcome: result.outcome ?? null,
      freshEngineChecks: 0,
      applyCalls: 0,
      sourceRecordTime: driver.sourceTime(),
      revokedHumanDenied: variant === 'after',
    };
  }
  const variant =
    command === 'lostBefore'
      ? 'before'
      : command === 'lostAfter'
        ? 'after'
        : command === 'recordBlocked'
          ? 'blocked'
          : 'normal';
  const source = variant === 'normal' ? 'source_native' : 'source_' + variant,
    target =
      variant === 'normal' ? 'source_target' : 'source_' + variant + '_target',
    key = 'local-source-' + variant;
  const driver = await driverFor(
    target,
    key,
    source,
    variant === 'before' ? 'before' : variant === 'after' ? 'after' : false,
    variant === 'blocked',
  );
  const original = fixture.original;
  const plan = await driver.service.prepare(
    {
      versionId: original.version_id,
      fingerprint: original.source_fingerprint,
      epoch: original.source_epoch,
      mode: 'publish',
    },
    signal,
  );
  let result;
  if (variant === 'blocked') {
    await assert.rejects(
      driver.service.confirm(plan.operation.id, plan.confirmation, signal),
      { code: 'recovery_required' },
    );
    const actual = await driver.deps.journal.get(plan.operation.id);
    assert.equal(actual.state, 'executing');
    result = { id: plan.operation.id, state: 'recovery_required' };
  } else
    result = await driver.service.confirm(
      plan.operation.id,
      plan.confirmation,
      signal,
    );
  assert.equal(fixture.checks() - checksBefore, 2);
  assert.equal(driver.calls(), 1);
  if (variant === 'normal') {
    assert.equal(result.state, 'committed');
    assert.equal(
      result.outcome.result,
      command === 'repeat' ? 'unchanged' : 'published',
    );
  } else {
    assert.equal(
      result.state,
      variant === 'blocked' ? 'recovery_required' : 'uncertain',
    );
    pending.set(variant, { target, key, source, operation: result });
  }
  return {
    state: result.state,
    outcome: result.outcome ?? null,
    freshEngineChecks: 2,
    applyCalls: 1,
    sourceRecordTime: driver.sourceTime(),
    cgroup: fixture.cgroup,
    verification: fixture.verificationFacts.slice(-2),
  };
}
