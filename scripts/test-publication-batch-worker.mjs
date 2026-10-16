// Actual Engine/service/SQL; Auth transport and human review are synthetic.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { publicationFixture, runServiceCommand } from '/service-worker.mjs';
import { driverFor } from '/source-worker.mjs';
const settings = JSON.parse(await readFile('/fixture/batch.json', 'utf8'));
let candidates = [],
  runner;
const normal = [],
  lost = [],
  calls = [];
const signal = () => new AbortController().signal;
const query = async (text, values = []) =>
  (await publicationFixture()).sessionQuery(text, values, settings.source);
const write = async (text, values = []) =>
  (await publicationFixture()).sessionMutation(text, values, settings.source);
async function send(command, abortSignal) {
  calls.push({
    action: command.action,
    id: command.action === 'prepare' ? command.versionId : command.operationId,
  });
  const row =
    command.action === 'prepare'
      ? candidates.findIndex((c) => c.versionId === command.versionId)
      : runner
          .snapshot()
          .rows.findIndex((r) => r.operationId === command.operationId);
  assert(row >= 0);
  const driver =
    command.action === 'confirm' && row === 1 ? lost[row] : normal[row];
  if (command.action === 'prepare')
    return driver.service.prepare(
      {
        versionId: command.versionId,
        fingerprint: command.fingerprint,
        epoch: command.epoch,
        mode: command.mode,
        batchId: command.batchId,
      },
      abortSignal,
    );
  if (command.action === 'confirm')
    return driver.service.confirm(
      command.operationId,
      command.confirmation,
      abortSignal,
    );
  if (command.action === 'cancel')
    return driver.service.cancel(command.operationId, abortSignal);
  return driver.service.recover(command.operationId, abortSignal);
}
const commands = {
  async create() {
    const f = await publicationFixture();
    const definition = (
      await query(
        'SELECT definition FROM public.exercise_versions WHERE id=$1::uuid',
        [f.original.version_id],
      )
    ).rows[0].definition;
    for (let i = 0; i < 3; i++) {
      const value = structuredClone(definition);
      value.title = 'LOT LOCAL — exercice ' + (i + 1);
      value.catalogue.appTitle = 'Lot local ' + (i + 1);
      const created = (
        await write(
          'SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,$1::jsonb) AS result',
          [JSON.stringify(value)],
        )
      ).rows[0].result;
      const v = (
        await query(
          'SELECT v.id,v.exercise_id::text,v.revision,v.definition,v.approval_fingerprint_sha256 AS fingerprint,v.test_epoch::text AS epoch,e.catalog_id FROM public.exercise_versions v JOIN public.exercises e ON e.id=v.exercise_id WHERE v.id=$1::uuid',
          [created.versionId],
        )
      ).rows[0];
      const cases = [
        {
          questionId: 'q',
          expectedState: 'incorrect',
          answer: { format: 'latex', source: '0' },
        },
      ];
      const report = await f.api.testPreview(
        v.definition,
        [0, 42],
        cases,
        signal(),
      );
      assert.equal(report.complete, true);
      assert.equal(report.passed, true);
      assert(BigInt(v.epoch) <= BigInt(Number.MAX_SAFE_INTEGER));
      const signed = f.api.signTestReceipt(
        {
          id: '10000000-0000-4000-8000-000000000001',
          key: Buffer.from('42'.repeat(32), 'hex'),
        },
        {
          actorId: f.actor,
          versionId: v.id,
          fingerprint: v.fingerprint,
          epoch: Number(v.epoch),
          report,
          cases,
        },
      );
      const receipt = (
        await write(
          'SELECT public.admin_record_exercise_test($1,$2) AS result',
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
              v.id,
              v.fingerprint,
              v.epoch,
              status,
              action,
              receipt.receiptId,
              JSON.stringify(checklist),
              'LOCAL SYNTHETIC BATCH REVIEW; NOT HUMAN ACCEPTANCE',
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
      candidates.push({
        versionId: v.id,
        exerciseId: v.exercise_id,
        catalogId: v.catalog_id,
        title: v.definition.title,
        revision: v.revision,
        fingerprint: v.fingerprint,
        epoch: v.epoch,
        status: 'approved',
        archived: false,
      });
      normal.push(
        await driverFor(
          settings.target,
          settings.key,
          settings.source,
          false,
          false,
          v.id,
        ),
      );
      lost.push(
        i === 1
          ? await driverFor(
              settings.target,
              settings.key,
              settings.source,
              'after',
              false,
              v.id,
            )
          : null,
      );
    }
    runner = new f.api.PublicationBatch(
      randomUUID(),
      candidates.map((c) => ({ versionId: c.versionId, operationId: null })),
      candidates,
      true,
      send,
    );
    return {
      candidates,
      nativeReceipts: 3,
      receiptSeeds: [0, 42],
      humanReviewSynthetic: true,
      cgroup: f.cgroup,
    };
  },
  async prepare() {
    const f = await publicationFixture(),
      before = f.checks();
    await runner.run('prepare');
    assert.deepEqual(
      runner.snapshot().rows.map((r) => r.phase),
      ['ready', 'ready', 'ready'],
    );
    assert.equal(f.checks() - before, 3);
    assert(normal.every((d) => d.calls() === 0));
    assert(!runner.checkpoint().includes('confirmation'));
    return {
      batchId: runner.batchId,
      freshEngineChecks: 3,
      applyCalls: 0,
      rows: runner.snapshot().rows.map((r) => ({
        versionId: r.versionId,
        operation: r.operation,
        action: r.prepared.plan.action,
      })),
    };
  },
  async partial() {
    const f = await publicationFixture(),
      before = f.checks();
    for (const c of candidates) runner.review(c.versionId, true);
    await runner.run('confirm');
    assert.deepEqual(
      runner.snapshot().rows.map((r) => r.phase),
      ['known', 'verify', 'ready'],
    );
    assert.equal(runner.snapshot().rows[0].operation.state, 'committed');
    assert.equal(runner.snapshot().rows[1].operation.state, 'uncertain');
    assert.equal(f.checks() - before, 2);
    assert.equal(normal[0].calls(), 1);
    assert.equal(lost[1].calls(), 1);
    assert.equal(normal[2].calls(), 0);
    runner.review(candidates[2].versionId, true);
    await runner.run('confirm');
    assert.equal(normal[2].calls(), 0);
    return {
      freshEngineChecks: 2,
      applyCalls: 2,
      thirdNotSent: true,
      checkpoint: runner.checkpoint(),
      rows: runner.snapshot().rows.map((r) => ({
        versionId: r.versionId,
        operation: r.operation,
        phase: r.phase,
      })),
    };
  },
  async recover() {
    const f = await publicationFixture(),
      before = f.checks(),
      beforeCalls = calls.length;
    const locator = f.api.parseBatchQuery(
      new URL('http://fixture' + runner.checkpoint()).searchParams,
    );
    runner = new f.api.PublicationBatch(
      locator.batchId,
      locator.items,
      candidates,
      true,
      send,
    );
    await runner.run('confirm');
    assert.equal(calls.length, beforeCalls);
    await runner.run('recover');
    assert.deepEqual(
      runner.snapshot().rows.map((r) => r.operation.state),
      ['committed', 'committed', 'planned'],
    );
    assert(runner.snapshot().rows.every((r) => r.prepared === null));
    assert.equal(f.checks(), before);
    assert.deepEqual(
      calls.slice(beforeCalls).map((c) => c.action),
      ['recover', 'recover', 'recover'],
    );
    return {
      freshEngineChecks: 0,
      applyCalls: 0,
      restoredWithoutConfirmationTokens: true,
      rows: runner.snapshot().rows.map((r) => r.operation),
    };
  },
  async cancel() {
    const f = await publicationFixture(),
      before = f.checks();
    await runner.run('cancel');
    assert.equal(runner.snapshot().rows[2].operation.state, 'cancelled');
    assert.equal(f.checks(), before);
    assert.equal(normal[2].calls(), 0);
    return { cancelled: true, freshEngineChecks: 0, applyCalls: 0 };
  },
  async finish() {
    const f = await publicationFixture(),
      before = f.checks();
    runner.replan(candidates[2].versionId);
    await runner.run('prepare');
    assert.equal(runner.snapshot().rows[2].phase, 'ready');
    runner.review(candidates[2].versionId, true);
    await runner.run('confirm');
    assert(
      runner.snapshot().rows.every((r) => r.operation.state === 'committed'),
    );
    assert.equal(f.checks() - before, 2);
    assert.equal(normal[0].calls(), 1);
    assert.equal(lost[1].calls(), 1);
    assert.equal(normal[2].calls(), 1);
    const rows = (
      await query(
        'SELECT id,editorial_status FROM public.exercise_versions WHERE id=ANY($1::uuid[])',
        [candidates.map((c) => c.versionId)],
      )
    ).rows;
    assert.equal(rows.length, 3);
    assert(rows.every((r) => r.editorial_status === 'published'));
    const journal = (
      await query(
        'SELECT public.admin_list_publication_operations() AS history',
      )
    ).rows[0].history.items.filter((i) => i.batchId === runner.batchId);
    assert.equal(journal.length, 4);
    assert.equal(journal.filter((i) => i.state === 'committed').length, 3);
    assert.equal(journal.filter((i) => i.state === 'cancelled').length, 1);
    return {
      freshEngineChecks: 2,
      applyCalls: 1,
      allThreePublished: true,
      cancelledPlanRetained: true,
      journalOperations: journal.length,
      rows: runner.snapshot().rows.map((r) => r.operation),
    };
  },
};
process.stdout.write(JSON.stringify({ ready: true }) + '\n');
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const { id, command } = JSON.parse(line);
    try {
      assert(Object.hasOwn(commands, command));
      process.stdout.write(
        JSON.stringify({ id, result: await commands[command]() }) + '\n',
      );
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          id,
          error: error.name,
          code: error.code ?? null,
          message:
            error instanceof assert.AssertionError
              ? error.message
              : 'Native batch command failed',
        }) + '\n',
      );
    }
  }
} finally {
  await runServiceCommand('close');
}
