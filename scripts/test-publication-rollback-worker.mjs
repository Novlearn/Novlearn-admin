// Real two-revision workflow on disposable local copies. Identity, session HTTP
// transport and human review attestations are synthetic; Engine/SQL are real.
import assert from 'node:assert/strict';
import { publicationFixture } from '/service-worker.mjs';
import { driverFor } from '/source-worker.mjs';
const database = 'rollback_source',
  target = 'rollback_target',
  key = 'local-functional-rollback';
let second, pending;
export async function runRollbackCommand(command) {
  const fixture = await publicationFixture();
  const query = (text, values = []) =>
    fixture.sessionQuery(text, values, database);
  const write = (text, values = []) =>
    fixture.sessionMutation(text, values, database);
  const signal = new AbortController().signal,
    before = fixture.checks();
  if (command === 'createSecond') {
    const original = (
      await query(
        'SELECT exercise_id::text AS parent,definition FROM public.exercise_versions WHERE id=$1::uuid',
        [fixture.original.version_id],
      )
    ).rows[0];
    const definition = structuredClone(original.definition);
    definition.title = 'Retour local — révision 2';
    definition.catalogue.appTitle = 'Retour local 2';
    definition.catalogue.difficulty = 3;
    const created = (
      await write(
        'SELECT public.admin_save_exercise_draft($1::bigint,NULL,NULL,$2::jsonb) AS result',
        [original.parent, JSON.stringify(definition)],
      )
    ).rows[0].result;
    const version = (
      await query(
        'SELECT id,definition,approval_fingerprint_sha256 AS fingerprint,test_epoch FROM public.exercise_versions WHERE id=$1::uuid',
        [created.versionId],
      )
    ).rows[0];
    assert.equal(created.revision, 2);
    const cases = [
      {
        questionId: 'q',
        answer: { format: 'latex', source: '0' },
        expectedState: 'incorrect',
      },
    ];
    const report = await fixture.api.testPreview(
      version.definition,
      [0, 42],
      cases,
      signal,
    );
    assert.equal(report.complete, true);
    assert.equal(report.passed, true);
    const signed = fixture.api.signTestReceipt(
      {
        id: '10000000-0000-4000-8000-000000000001',
        key: Buffer.from('42'.repeat(32), 'hex'),
      },
      {
        actorId: fixture.actor,
        versionId: version.id,
        fingerprint: version.fingerprint,
        epoch: Number(version.test_epoch),
        report,
        cases,
      },
    );
    const receipt = (
      await write(
        'SELECT public.admin_record_exercise_test($1::text,$2::text) AS result',
        [signed.payload, signed.signature],
      )
    ).rows[0].result;
    assert.equal(receipt.recorded, true);
    assert.equal(receipt.passed, true);
    const review = async (status, action, checklist) =>
      (
        await write(
          'SELECT public.admin_review_exercise_version($1::uuid,$2::text,$3::bigint,$4::text,$5::text,$6::uuid,$7::jsonb,$8::text) AS result',
          [
            version.id,
            version.fingerprint,
            version.test_epoch,
            status,
            action,
            receipt.receiptId,
            JSON.stringify(checklist),
            'Synthetic local fixture review; no actual human acceptance',
          ],
        )
      ).rows[0].result;
    assert.equal(
      (await review('draft', 'request_review', {})).status,
      'in_review',
    );
    assert.equal(
      (
        await review('in_review', 'approve', {
          mathematicsCorrect: true,
          statementClear: true,
          gradingChecked: true,
          referencesChecked: true,
        })
      ).status,
      'approved',
    );
    second = {
      versionId: version.id,
      fingerprint: version.fingerprint,
      epoch: String(version.test_epoch),
    };
    return {
      state: 'approved',
      second,
      nativeReceipt: true,
      nativeReceiptSeeds: report.seeds.map((s) => s.seed),
      humanReviewSynthetic: true,
      cgroup: fixture.cgroup,
    };
  }
  if (command === 'recoverLost') {
    assert(pending);
    const driver = await driverFor(target, key, database);
    const result = await driver.service.recover(pending.id, signal);
    assert.equal(result.state, 'committed');
    assert.equal(result.outcome.result, 'unchanged');
    assert.equal(driver.calls(), 0);
    assert.equal(fixture.checks(), before);
    return {
      state: result.state,
      outcome: result.outcome,
      applyCalls: 0,
      freshEngineChecks: 0,
      sourceRecordTime: driver.sourceTime(),
    };
  }
  const useSecond = [
    'missingSecond',
    'publishSecond',
    'republishSecond',
  ].includes(command);
  if (useSecond) assert(second);
  const selection = useSecond
    ? second
    : {
        versionId: fixture.original.version_id,
        fingerprint: fixture.original.source_fingerprint,
        epoch: fixture.original.source_epoch,
      };
  const rollback = [
    'missingSecond',
    'lostFirst',
    'repeatFirst',
    'activateFirst',
  ].includes(command);
  const driver = await driverFor(
    target,
    key,
    database,
    command === 'lostFirst' ? 'after' : false,
    false,
    selection.versionId,
  );
  if (command === 'missingSecond' || command === 'implicitFirst') {
    await assert.rejects(
      driver.service.prepare(
        { ...selection, mode: rollback ? 'rollback' : 'publish' },
        signal,
      ),
      { code: 'conflict' },
    );
    assert.equal(driver.calls(), 0);
    assert.equal(fixture.checks() - before, 1);
    return {
      state: 'rejected',
      reason:
        command === 'missingSecond'
          ? 'revision absent from target cannot be rolled back'
          : 'older revision requires explicit rollback',
      applyCalls: 0,
      freshEngineChecks: 1,
      sourceRecordTime: null,
    };
  }
  const plan = await driver.service.prepare(
    { ...selection, mode: rollback ? 'rollback' : 'publish' },
    signal,
  );
  const expectedAction =
    command === 'publishFirst'
      ? 'create_exercise'
      : command === 'publishSecond'
        ? 'append_revision'
        : command === 'repeatFirst'
          ? 'unchanged'
          : command === 'republishSecond'
            ? 'activate_revision'
            : 'rollback';
  assert.equal(plan.plan.action, expectedAction);
  const result = await driver.service.confirm(
    plan.operation.id,
    plan.confirmation,
    signal,
  );
  assert.equal(fixture.checks() - before, 2);
  assert.equal(driver.calls(), 1);
  if (command === 'lostFirst') {
    assert.equal(result.state, 'uncertain');
    pending = result;
  } else {
    assert.equal(result.state, 'committed');
    assert.equal(
      result.outcome.result,
      command === 'repeatFirst'
        ? 'unchanged'
        : rollback
          ? 'rolled_back'
          : 'published',
    );
  }
  return {
    state: result.state,
    outcome: result.outcome ?? null,
    action: plan.plan.action,
    applyCalls: 1,
    freshEngineChecks: 2,
    sourceRecordTime: driver.sourceTime(),
    targetRecordTime: driver.targetTime(),
    cgroup: fixture.cgroup,
    verification: fixture.verificationFacts.slice(-2),
  };
}
