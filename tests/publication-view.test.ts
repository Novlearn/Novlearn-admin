import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import native from './fixtures/publication-journal-sql.json';
import { planPublication } from '@/lib/publication';
import {
  publicationSummary,
  preparedPublication,
  publicationHistory,
  requestPublication,
  publicationIntent,
  type PublicationSummary,
} from '@/lib/publication-view';
import {
  PublicationPanel,
  PublicationResult,
} from '@/components/publication-panel';
import { PublicationHistoryActions } from '@/components/publication-history-actions';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const summary = (): PublicationSummary => ({
  id: native.id,
  batchId: native.batch_id,
  sourceVersionId: native.version_id,
  catalogId: native.payload.catalogId,
  revision: native.payload.revision,
  mode: 'publish',
  state: 'planned',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  outcome: null,
  error: null,
});
const prepared = () => ({
  operation: summary(),
  plan: planPublication(native.payload, native.inspection, 'publish'),
  confirmation: 'Zml4dHVyZQ.' + 'a'.repeat(64),
});
const packet = (result: unknown) => ({
  sourceEnvironment: 'staging',
  targetEnvironment: 'production',
  result,
});
const historyItem = () => ({
  id: native.id,
  batchId: native.batch_id,
  versionId: native.version_id,
  catalogId: native.payload.catalogId,
  targetKey: native.target_key,
  mode: 'publish',
  state: 'planned',
  createdAt: native.created_at,
  updatedAt: native.updated_at,
  errorCode: null,
});
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
it('decodes the exact minimal server projection without accepting a private journal row', () => {
  const input = summary();
  expect(publicationSummary(input)).toEqual(input);
  expect(publicationSummary(native)).toBeNull();
  expect(publicationSummary({ ...summary(), source_snapshot: {} })).toBeNull();
});
it('accepts only a committed observation with matching content identity and exact bigint text', () => {
  const committed = {
    ...summary(),
    state: 'committed',
    outcome: structuredClone(native.outcome),
  };
  expect(publicationSummary(committed)?.outcome?.exerciseId).toBe(
    '9007199254740993',
  );
  for (const bad of [
    { ...committed, outcome: null },
    { ...summary(), outcome: native.outcome },
    { ...committed, outcome: { ...native.outcome, catalogId: 'wrong' } },
    {
      ...committed,
      outcome: { ...native.outcome, exerciseId: 9007199254740992 },
    },
    { ...committed, error: 'not_applied' },
  ])
    expect(publicationSummary(bad)).toBeNull();
});
it('requires definite failure metadata and rejects fabricated success states', () => {
  expect(publicationSummary({ ...summary(), state: 'uncertain' })?.state).toBe(
    'uncertain',
  );
  expect(
    publicationSummary({ ...summary(), state: 'failed', error: 'not_applied' })
      ?.state,
  ).toBe('failed');
  for (const input of [
    { ...summary(), state: 'failed' },
    { ...summary(), state: 'published' },
    { ...summary(), state: 'uncertain', outcome: native.outcome },
    { ...summary(), expiresAt: 'invalid' },
  ])
    expect(publicationSummary(input)).toBeNull();
});
it('decodes the full diff without stripping added or removed fields omitted by JSON', () => {
  const input = prepared();
  input.plan.headerChanges = [
    { path: '/title', before: undefined, after: 'Nouveau titre' },
  ];
  const wire = JSON.parse(JSON.stringify(input));
  expect(preparedPublication(wire)?.plan.headerChanges).toEqual([
    { path: '/title', after: 'Nouveau titre' },
  ]);
  expect(
    preparedPublication({ ...input, confirmation: 'unsigned' }),
  ).toBeNull();
  expect(
    preparedPublication({
      ...input,
      plan: { ...input.plan, catalogId: 'wrong' },
    }),
  ).toBeNull();
  expect(
    preparedPublication({
      ...input,
      plan: { ...input.plan, action: 'rollback' },
    }),
  ).toBeNull();
});
it('rejects malformed or mismatched diff protocols instead of rendering a confirmation', () => {
  for (const plan of [
    { ...prepared().plan, headerChanges: [{ path: 'invalid', after: 1 }] },
    { ...prepared().plan, definitionChanges: 'invalid' },
    { ...prepared().plan, action: '__proto__' },
    { ...prepared().plan, revision: 2 },
  ])
    expect(preparedPublication({ ...prepared(), plan })).toBeNull();
});
it('decodes at most 25 unique owned-history projections and rejects private extras', () => {
  const input = { total: 1, items: [historyItem()] };
  expect(publicationHistory(input)).toEqual(input);
  for (const data of [
    { total: 1, items: [{ ...historyItem(), payload: native.payload }] },
    { total: 2, items: [historyItem(), historyItem()] },
    { total: 0, items: [historyItem()] },
    { total: 1, items: [{ ...historyItem(), state: 'failed' }] },
    { total: '1', items: [historyItem()] },
  ])
    expect(publicationHistory(data)).toBeNull();
});
it('sends only one same-origin POST with the exact selection and no client definition or report', async () => {
  const input = prepared();
  fetcher.mockResolvedValue(new Response(JSON.stringify(packet(input))));
  const command = {
    action: 'prepare' as const,
    versionId: native.version_id,
    fingerprint: native.source_fingerprint,
    epoch: '0',
    mode: 'publish' as const,
    batchId: native.batch_id,
  };
  const result = await requestPublication(command);
  expect(result).toEqual(input);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('/api/admin/publication');
  expect(options).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
  });
  expect(JSON.parse(String(options?.body))).toEqual(command);
});
it('does not retry after a lost confirmation response or invent a result', async () => {
  fetcher.mockRejectedValue(new Error('socket closed'));
  await expect(
    requestPublication({
      action: 'confirm',
      operationId: native.id,
      confirmation: 'signed',
    }),
  ).rejects.toThrow('Vérifiez le résultat');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('preserves an uncertain 202 observation and does not treat it as a successful transfer', async () => {
  fetcher.mockResolvedValue(
    new Response(JSON.stringify(packet({ ...summary(), state: 'uncertain' })), {
      status: 202,
    }),
  );
  await expect(
    requestPublication({
      action: 'confirm',
      operationId: native.id,
      confirmation: 'signed',
    }),
  ).resolves.toMatchObject({ state: 'uncertain', outcome: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(['environment', 'operation', 'premature', 'private'])(
  'refuses an unconfirmed %s result',
  async (kind) => {
    let response: unknown = packet({
      ...summary(),
      state: 'committed',
      outcome: native.outcome,
    });
    if (kind === 'environment')
      response = { ...packet(summary()), targetEnvironment: 'staging' };
    if (kind === 'operation')
      response = packet({
        ...summary(),
        id: native.version_id,
        state: 'committed',
        outcome: native.outcome,
      });
    if (kind === 'premature') response = packet(summary());
    if (kind === 'private') response = packet(native);
    fetcher.mockResolvedValue(new Response(JSON.stringify(response)));
    await expect(
      requestPublication({
        action: 'confirm',
        operationId: native.id,
        confirmation: 'signed',
      }),
    ).rejects.toThrow();
  },
);
it('does not cancel or confirm when the returned identity differs from the requested plan', async () => {
  fetcher.mockResolvedValue(new Response(JSON.stringify(packet(prepared()))));
  await expect(
    requestPublication({
      action: 'prepare',
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: '0',
      mode: 'rollback',
      batchId: native.batch_id,
    }),
  ).rejects.toThrow('ne correspond pas');
  fetcher.mockResolvedValue(new Response(JSON.stringify(packet(summary()))));
  await expect(
    requestPublication({ action: 'cancel', operationId: native.id }),
  ).rejects.toThrow();
});
it('retains a recovery-required error, rejects HTML and relays the cancellation signal', async () => {
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        code: 'recovery_required',
        error: 'Vérification nécessaire',
      }),
      { status: 409 },
    ),
  );
  await expect(
    requestPublication({ action: 'recover', operationId: native.id }),
  ).rejects.toMatchObject({ code: 'recovery_required' });
  fetcher.mockResolvedValueOnce(new Response('<html>login</html>'));
  const signal = new AbortController().signal;
  await expect(
    requestPublication({ action: 'recover', operationId: native.id }, signal),
  ).rejects.toThrow('Réponse non reconnue');
  expect(fetcher.mock.calls[1][1]?.signal).toBe(signal);
});
it('renders a disabled workflow and no confirm button before a reviewed diff exists', () => {
  const html = renderToStaticMarkup(
    createElement(PublicationPanel, {
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: '0',
      revision: 1,
      status: 'approved',
      enabled: false,
    }),
  );
  expect(html).toContain('attend l’activation');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('Confirmer la publication');
  expect(html).toContain('/admin/publication');
});
it('renders the approval requirement and an uncertain observation without a published label', () => {
  const draft = renderToStaticMarkup(
    createElement(PublicationPanel, {
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: '0',
      revision: 1,
      status: 'draft',
      enabled: true,
    }),
  );
  expect(draft).toContain('doit être approuvée');
  const uncertain = renderToStaticMarkup(
    createElement(PublicationResult, {
      operation: { ...summary(), state: 'uncertain' },
    }),
  );
  expect(uncertain).toContain('La publication n’est pas confirmée');
  expect(uncertain).not.toContain('Transfert confirmé');
});
it('renders history recovery and planned cancellation with no publish action', () => {
  const html = renderToStaticMarkup(
    createElement(PublicationHistoryActions, {
      item: historyItem() as Parameters<
        typeof PublicationHistoryActions
      >[0]['item'],
      enabled: true,
    }),
  );
  expect(html).toContain('Vérifier le résultat');
  expect(html).toContain('Annuler ce plan');
  expect(html).not.toContain('Confirmer la publication');
});
it('requires an explicit reviewed and unexpired plan before emitting any confirmation command', () => {
  const plan = prepared(),
    context = {
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: '0',
      mode: 'publish' as const,
      enabled: true,
      busy: false,
      eligible: true,
      accepted: true,
      mustObserve: false,
      prepared: plan,
      operation: plan.operation,
      now: Date.now(),
    };
  expect(publicationIntent('confirm', context)).toEqual({
    action: 'confirm',
    operationId: plan.operation.id,
    confirmation: plan.confirmation,
  });
  for (const changed of [
    { accepted: false },
    { eligible: false },
    { prepared: null },
    { busy: true },
    { enabled: false },
    { mustObserve: true },
    { now: Date.parse(plan.operation.expiresAt) + 1 },
    { operation: { ...plan.operation, state: 'uncertain' as const } },
    {
      operation: {
        ...plan.operation,
        state: 'committed' as const,
        outcome: native.outcome as PublicationSummary['outcome'],
      },
    },
  ])
    expect(publicationIntent('confirm', { ...context, ...changed })).toBeNull();
  expect(publicationIntent('prepare', context)).toBeNull();
  expect(
    publicationIntent('cancel', { ...context, mustObserve: true }),
  ).toBeNull();
  expect(
    publicationIntent('recover', { ...context, mustObserve: true }),
  ).toEqual({ action: 'recover', operationId: plan.operation.id });
});
it('does not even allocate a new batch for ineligible content and does not recreate a pending transfer', () => {
  const batch = vi.fn(() => native.batch_id),
    context = {
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: '0',
      mode: 'publish' as const,
      enabled: true,
      busy: false,
      eligible: false,
      accepted: false,
      mustObserve: false,
      prepared: null,
      operation: null,
      now: Date.now(),
    };
  expect(publicationIntent('prepare', context, batch)).toBeNull();
  expect(batch).not.toHaveBeenCalled();
  expect(
    publicationIntent('prepare', { ...context, eligible: true }, batch),
  ).toMatchObject({ action: 'prepare', batchId: native.batch_id });
  expect(batch).toHaveBeenCalledTimes(1);
});
