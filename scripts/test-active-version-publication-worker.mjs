// Real target driver/SQL with a synthetic source operation and pre-commit callback.
// This proves target regression only, never source Auth/approval or HTTP receipts.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import {
  createPublicationPgPools,
  PublicationTarget,
  decodeActiveVersionSnapshot,
  activeVersionState,
} from './target.mjs';
const settings = JSON.parse(await readFile('/fixture/private.json', 'utf8'));
const database = settings.database;
const sockets = new Set();
const proxy = net.createServer((client) => {
  const upstream = net.connect({ host: '127.0.0.1', port: 5432 });
  for (const s of [client, upstream]) {
    sockets.add(s);
    s.on('error', () => {
      client.destroy();
      upstream.destroy();
    });
    s.on('close', () => sockets.delete(s));
  }
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(55434, '127.0.0.1', resolve);
});
const owner = new pg.Client({
  host: '127.0.0.1',
  port: 5432,
  database,
  user: 'supabase_admin',
  ssl: { ca: settings.ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 3000,
});
await owner.connect();
const pools = createPublicationPgPools(settings.config);
const target = new PublicationTarget(pools.target, 'local-http-fixture');
const checks = [],
  observations = [];
const check = (label) => checks.push(label);
const query = await readFile('/app/scripts/active-version-query.sql', 'utf8');
const observe = async (catalogId) => {
  try {
    await owner.query('BEGIN READ ONLY');
    await owner.query(
      'SET SESSION AUTHORIZATION novlearn_active_version_reader',
    );
    const identity = (await owner.query('SELECT current_user, session_user'))
      .rows[0];
    assert.deepEqual(identity, {
      current_user: 'novlearn_active_version_reader',
      session_user: 'novlearn_active_version_reader',
    });
    const rows = (await owner.query(query, [catalogId])).rows;
    assert.equal(rows.length, 1);
    const decoded = decodeActiveVersionSnapshot(
      {
        ...rows[0].active_version,
        environment: 'local-copy',
        targetKey: 'local-http-fixture',
      },
      { environment: 'local-copy', targetKey: 'local-http-fixture', catalogId },
    );
    assert(decoded, 'Actual minimal SQL snapshot must decode');
    observations.push({
      catalogId,
      active: decoded.active?.revision ?? null,
      epoch: decoded.parent?.publicationEpoch ?? null,
      state: activeVersionState(decoded).state,
    });
    return decoded;
  } finally {
    await owner.query('ROLLBACK');
    await owner.query('RESET SESSION AUTHORIZATION');
  }
};
const payload = async (catalogId, revision, label) =>
  (
    await owner.query(
      `WITH seed AS (SELECT v.definition,v.engine_contract,v.generation_version,v.canonicalization_version FROM public.exercise_versions v WHERE v.editorial_status='published' ORDER BY v.exercise_id,v.revision LIMIT 1), value AS (SELECT jsonb_set(jsonb_set(jsonb_set(definition,'{id}',to_jsonb($1::text)),'{revision}',to_jsonb($2::text)),'{title}',to_jsonb($3::text)) AS definition,engine_contract,generation_version,canonicalization_version FROM seed) SELECT jsonb_build_object('schemaVersion',1,'catalogId',$1::text,'revision',$2::integer,'definitionJson',definition::text,'engineContract',engine_contract,'generationVersion',generation_version,'canonicalizationVersion',canonicalization_version,'engineArchiveSha256',(SELECT engine_archive_sha256 FROM novlearn_admin_private.publication_runtime WHERE singleton),'businessDigest',public.exercise_publication_digest(definition,engine_contract,generation_version,canonicalization_version)) AS payload FROM value`,
      [catalogId, String(revision), '[ESSAI LOCAL SQL70] ' + label],
    )
  ).rows[0].payload;
const plan = async (value, mode = 'publish') => {
  const version = randomUUID(),
    now = new Date().toISOString();
  return {
    id: randomUUID(),
    batch_id: randomUUID(),
    actor_id: randomUUID(),
    version_id: version,
    target_key: 'local-http-fixture',
    mode,
    source_fingerprint: 'a'.repeat(64),
    source_epoch: '0',
    plan_digest: 'b'.repeat(64),
    state: 'planned',
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 120000).toISOString(),
    payload: value,
    inspection: await target.inspect(value, mode),
    source_snapshot: {
      versionId: version,
      fingerprint: 'a'.repeat(64),
      epoch: '0',
      reviewId: randomUUID(),
      receiptId: randomUUID(),
    },
    outcome: null,
    error_code: null,
  };
};
const apply = async (operation, callback = async () => {}, driver = target) =>
  driver.withLease(operation, (lease) =>
    lease.apply({ ...operation, state: 'executing' }, callback),
  );
try {
  const wrongUrl = new URL(settings.config.target.url);
  wrongUrl.password = 'incorrect-local-fixture-password';
  const wrong = new pg.Client({
    connectionString: wrongUrl.href,
    ssl: { ca: settings.ca, rejectUnauthorized: true },
    connectionTimeoutMillis: 3000,
  });
  try {
    await assert.rejects(wrong.connect(), (error) => error.code === '28P01');
  } finally {
    await wrong.end();
  }
  check('new database writer requires the preserved SCRAM password');
  const connection = await pools.target();
  try {
    assert.equal(connection.connection.stream.authorized, true);
    assert.equal(connection.connection.stream.encrypted, true);
    await assert.rejects(
      connection.query('SELECT definition FROM public.exercise_versions'),
      (error) => error.code === '42501',
    );
  } finally {
    connection.release();
  }
  check(
    'actual TLS publication pool audits exact writer identity and denies direct table reads',
  );
  const id = randomUUID(),
    one = await payload(id, 1, 'révision 1'),
    two = await payload(id, 2, 'révision 2');
  assert.equal(activeVersionState(await observe(id)).state, 'absent');
  check('reader observes actual absence before the new publication');
  let callbacks = 0;
  const first = await apply(await plan(one), async () => {
    callbacks++;
  });
  assert.equal(first.state, 'committed');
  assert.equal(first.outcome.result, 'published');
  assert.equal(callbacks, 1);
  const published = await observe(id);
  assert.equal(published.active.revision, 1);
  check('target driver commits revision 1 and the minimal reader observes it');
  const again = await apply(await plan(one));
  assert.equal(again.state, 'committed');
  assert.equal(again.outcome.result, 'unchanged');
  assert.deepEqual((await observe(id)).parent, published.parent);
  check('identical publication is idempotent and does not advance epoch');
  assert.equal((await apply(await plan(two))).state, 'committed');
  assert.equal((await observe(id)).active.revision, 2);
  check('revision 2 publication updates the current pointer');
  const rolled = await apply(await plan(one, 'rollback'));
  assert.equal(rolled.state, 'committed');
  assert.equal(rolled.outcome.result, 'rolled_back');
  const rollback = await observe(id);
  assert.equal(rollback.active.revision, 1);
  assert.equal(
    (
      await owner.query(
        'SELECT max(v.revision) AS latest FROM public.exercise_versions v JOIN public.exercises e ON e.id=v.exercise_id WHERE e.catalog_id=$1::uuid',
        [id],
      )
    ).rows[0].latest,
    2,
  );
  check('explicit rollback selects revision 1 while MAX revision remains 2');
  const repeatedRollback = await apply(await plan(one, 'rollback'));
  assert.equal(repeatedRollback.outcome.result, 'unchanged');
  assert.deepEqual((await observe(id)).parent, rollback.parent);
  check('repeated rollback is idempotent');
  const abortId = randomUUID(),
    abortPayload = await payload(abortId, 1, 'annulation avant COMMIT');
  const aborted = await apply(await plan(abortPayload), async () => {
    throw Error('synthetic pre-commit revocation');
  });
  assert.equal(aborted.state, 'aborted');
  assert.equal(activeVersionState(await observe(abortId)).state, 'absent');
  check('failing pre-commit recheck rolls back all target rows');
  const threeA = await payload(id, 3, 'conflit A'),
    threeB = await payload(id, 3, 'conflit B');
  const stale = await plan(threeA);
  assert.equal((await apply(await plan(threeB))).state, 'committed');
  let staleCallback = false;
  assert.equal(
    (
      await apply(stale, async () => {
        staleCallback = true;
      })
    ).state,
    'aborted',
  );
  assert.equal(staleCallback, false);
  assert.equal((await observe(id)).active.revision, 3);
  check(
    'stale inspection and conflicting immutable revision abort without a commit callback',
  );
  await assert.rejects(
    target.inspect({ ...one, businessDigest: '0'.repeat(64) }, 'publish'),
  );
  check('wrong business digest is rejected by the unchanged target');
  const lostId = randomUUID(),
    lostPayload = await payload(lostId, 1, 'confirmation perdue');
  const lostPlan = await plan(lostPayload);
  let lost = false;
  const lostDriver = new PublicationTarget(async () => {
    const c = await pools.target();
    return {
      query: async (text, values) => {
        const r = await c.query(text, values);
        if (text === 'COMMIT' && !lost) {
          lost = true;
          throw Error('synthetic lost acknowledgement after real commit');
        }
        return r;
      },
      release: (destroy) => c.release(destroy),
    };
  }, 'local-http-fixture');
  assert.equal(
    (await apply(lostPlan, async () => {}, lostDriver)).state,
    'uncertain',
  );
  assert.equal(lost, true);
  const recovery = await target.withLease(
    { ...lostPlan, state: 'uncertain' },
    (lease) => lease.observe(),
  );
  assert.equal(recovery.state, 'committed');
  assert.equal((await observe(lostId)).active.revision, 1);
  check(
    'lost commit acknowledgement remains uncertain until actual target observation resolves it',
  );
  await owner.query('SET SESSION AUTHORIZATION novlearn_active_version_reader');
  for (const statement of [
    'SELECT definition FROM public.exercise_versions',
    'UPDATE public.exercises SET title=title',
    "SELECT public.apply_exercise_publication('{}'::jsonb,repeat('0',64),'publish')",
    "SELECT nextval('public.exercises_id_seq')",
  ])
    await assert.rejects(
      owner.query(statement),
      (error) => error.code === '42501',
    );
  await owner.query('RESET SESSION AUTHORIZATION');
  check(
    'new metadata reader still cannot read definitions, write, publish or consume sequences',
  );
  await writeFile(
    '/output/worker-proof.json',
    JSON.stringify(
      {
        result: 'PASS',
        checks,
        observations,
        realTargetDriver: true,
        realTls: true,
        writerScramVerified: true,
        activeReaderUsesNativeSessionAuthorization: true,
        sourceOperationSynthetic: true,
        sourceAuthAndJournalNotCertified: true,
        freshEngineCertification: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      observations: observations.length,
    }),
  );
} finally {
  await pools.close();
  await owner.end();
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
