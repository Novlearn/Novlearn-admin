// Fixed local experiments using the real SQL journal, target primitive and TLS
// pools. Identity is synthetic; source approval comes from the retained native
// receipt fixture. No fresh Engine certification or remote publication is claimed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  createPublicationPgPools,
  PublicationJournal,
  PublicationTarget,
} from '/fixture/bundle/native.mjs';
let context;
async function setup() {
  if (context) return context;
  const { config, actor } = JSON.parse(
    await readFile('/fixture/client.json', 'utf8'),
  );
  const { source } = JSON.parse(
    await readFile('/fixture/target-input.json', 'utf8'),
  );
  const sourceUrl = new URL(config.source.url);
  sourceUrl.pathname = '/transfer_source';
  const clients = [];
  const connectTo = (database, loss = null) => {
    const targetUrl = new URL(config.target.url);
    targetUrl.pathname = '/' + database;
    const pools = createPublicationPgPools({
      ...config,
      source: { ...config.source, url: sourceUrl.href },
      target: { ...config.target, url: targetUrl.href },
    });
    clients.push(pools);
    let applyCalls = 0;
    const connect = async () => {
      const connection = await pools.target();
      return {
        query: async (text, values) => {
          if (text.includes('public.apply_exercise_publication')) applyCalls++;
          if (text === 'COMMIT' && loss === 'before')
            throw Error('Simulated loss before sending commit');
          if (text === 'COMMIT' && loss === 'socket') {
            connection.connection.stream.destroy();
            await new Promise((resolve) => setTimeout(resolve, 50));
            throw Error('Actual fixture socket destroyed before commit');
          }
          const result = await connection.query(text, values);
          if (text === 'COMMIT' && loss === 'after')
            throw Error('Simulated lost acknowledgement after actual commit');
          return result;
        },
        release: (destroy) => connection.release(destroy),
      };
    };
    return { connect, pools, calls: () => applyCalls };
  };
  const sourcePools = connectTo('transfer_target');
  const auth = {
    getVerifiedUser: async () => ({ id: actor, isAnonymous: false }),
    getProfileRole: async () => 'admin',
  };
  let sourceRecordTime = null;
  const sourceConnect = async () => {
    const connection = await sourcePools.pools.source();
    return {
      query: async (text, values) => {
        const recording = text.includes(
          'novlearn_admin_private.record_publication_outcome',
        );
        const result = await connection.query(
          recording
            ? text + ', transaction_timestamp()::text AS fixture_source_time'
            : text,
          values,
        );
        if (recording) sourceRecordTime = result.rows[0].fixture_source_time;
        return result;
      },
      release: (destroy) => connection.release(destroy),
    };
  };
  const journal = new PublicationJournal(auth, sourceConnect);
  context = {
    source,
    journal,
    connectTo,
    clients,
    pending: new Map(),
    sourceTime: () => sourceRecordTime,
  };
  return context;
}
async function plan(target, key) {
  const { source, journal } = await setup();
  const inspection = await target.inspect(source.payload, source.mode);
  return journal.prepare({
    batchId: randomUUID(),
    versionId: source.version_id,
    fingerprint: source.source_fingerprint,
    epoch: source.source_epoch,
    targetKey: key,
    mode: source.mode,
    payload: source.payload,
    inspection,
  });
}
async function execute(
  database,
  key,
  { loss = null, abort = false, contend = false } = {},
) {
  const c = await setup();
  const driver = c.connectTo(database, loss);
  const target = new PublicationTarget(driver.connect, key);
  const prepared = await plan(target, key);
  let contended = false;
  let contendedAfterCommit = false;
  const result = await target.withLease(prepared, async (lease) => {
    // The target session lock MUST precede the durable source claim. Recovery
    // cannot decide not_applied while this active publisher is still working.
    const claimed = await c.journal.claim(
      prepared.id,
      prepared.plan_digest,
      'claim',
    );
    const execution = await c.journal.withSourceLease(
      claimed.id,
      claimed.plan_digest,
      async (locked, recheck) => {
        const execution = await lease.apply(locked, async () => {
          if (contend) {
            const competitor = new PublicationTarget(
              c.connectTo(database).connect,
              key,
            );
            let entered = false;
            await assert.rejects(
              competitor.withLease(claimed, async () => {
                entered = true;
              }),
              { code: 'unavailable' },
            );
            assert.equal(entered, false);
            assert.equal(
              (await c.journal.pending()).items[0].state,
              'executing',
            );
            contended = true;
          }
          await recheck();
          if (abort) throw Error('Fixture before-commit access check failed');
        });
        return execution;
      },
    );
    const state =
      execution.state === 'committed'
        ? 'committed'
        : execution.state === 'aborted'
          ? 'failed'
          : 'uncertain';
    if (contend && execution.state === 'committed') {
      const competitor = new PublicationTarget(
        c.connectTo(database).connect,
        key,
      );
      let entered = false;
      await assert.rejects(
        competitor.withLease(claimed, async () => {
          entered = true;
        }),
        { code: 'unavailable' },
      );
      assert.equal(entered, false);
      contendedAfterCommit = true;
    }
    const recorded = await c.journal.record(
      claimed,
      'executing',
      state,
      execution.state === 'committed' ? execution.outcome : null,
      execution.state === 'aborted' ? 'not_applied' : null,
    );
    assert.equal(recorded.state, state);
    return { execution, operation: recorded };
  });
  assert.equal(driver.calls(), 1);
  if (loss) {
    assert.equal(result.execution.state, 'uncertain');
    c.pending.set(key, { ...result, driver, database });
  } else if (abort) assert.equal(result.execution.state, 'aborted');
  else assert.equal(result.execution.state, 'committed');
  return {
    state: result.execution.state,
    outcome: result.execution.outcome ?? null,
    operationState: result.operation.state,
    applyCalls: driver.calls(),
    contended,
    contendedAfterCommit,
    sourceRecordTime: c.sourceTime(),
  };
}
async function recover(key, expected) {
  const c = await setup();
  const old = c.pending.get(key);
  assert(old);
  const operation = (await c.journal.pending()).items.find(
    (item) => item.id === old.operation.id,
  );
  assert(operation);
  const driver = c.connectTo(old.database);
  const target = new PublicationTarget(driver.connect, key);
  const observation = await target.withLease(operation, async (lease) => {
    const observation = await lease.observe();
    assert.equal(observation.state, expected);
    if (observation.state === 'committed')
      await c.journal.record(
        operation,
        'uncertain',
        'committed',
        observation.outcome,
      );
    else if (observation.state === 'not_applied')
      await c.journal.record(
        operation,
        'uncertain',
        'failed',
        null,
        'not_applied',
      );
    return observation;
  });
  assert.equal(driver.calls(), 0);
  assert(
    !(await c.journal.pending()).items.some((item) => item.id === operation.id),
  );
  return {
    state: observation.state,
    outcome: observation.outcome ?? null,
    applyCallsDuringRecovery: driver.calls(),
    sourceRecordTime: c.sourceTime(),
  };
}
export async function runTransferCommand(command) {
  if (command === 'publish')
    return execute('transfer_target', 'local-transactions', { contend: true });
  if (command === 'repeat')
    return execute('transfer_target', 'local-transactions');
  if (command === 'abort')
    return execute('transfer_abort', 'local-abort', { abort: true });
  if (command === 'lostAfter')
    return execute('transfer_lost_after', 'local-lost-after', {
      loss: 'after',
    });
  if (command === 'recoverAfter')
    return recover('local-lost-after', 'committed');
  if (command === 'lostBefore')
    return execute('transfer_lost_before', 'local-lost-before', {
      loss: 'before',
    });
  if (command === 'recoverBefore')
    return recover('local-lost-before', 'not_applied');
  if (command === 'lostSocket')
    return execute('transfer_socket', 'local-socket-loss', { loss: 'socket' });
  if (command === 'recoverSocket')
    return recover('local-socket-loss', 'not_applied');
  if (command === 'close') {
    if (context) for (const pool of context.clients) await pool.close();
    return { closed: true };
  }
  throw Error('Unknown fixed local command');
}
