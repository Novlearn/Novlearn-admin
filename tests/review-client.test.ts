import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  reviewContextKey,
  reviewIntent,
  reviewResult,
  requestReview,
  ReviewRequestError,
  reviewChecklistLabels,
  type ReviewRequest,
  type ReviewContext,
} from '@/lib/review';
import { EditorialReview } from '@/components/editorial-review';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const context = (): ReviewContext => ({
  versionId: 'a7500000-0000-4000-8000-000000000001',
  fingerprint: 'a'.repeat(64),
  epoch: 0,
  status: 'in_review',
  receiptId: 'a7500000-0000-4000-8000-000000000002',
  enabled: true,
  archived: false,
});
const checklist = () =>
  Object.fromEntries(
    Object.keys(reviewChecklistLabels).map((key) => [key, true]),
  );
const input = (): ReviewRequest =>
  reviewIntent('approve', context(), checklist(), 'Relecture de test')!;
const result = () => ({
  reviewId: 'a7500000-0000-4000-8000-000000000003',
  versionId: context().versionId,
  fingerprint: context().fingerprint,
  epoch: 0,
  status: 'approved',
});
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());
it('does not infer human attestation from a successful receipt', () => {
  expect(reviewIntent('approve', context(), {}, '')).toBeNull();
  const html = renderToStaticMarkup(createElement(EditorialReview, context()));
  expect(html.match(/type="checkbox"/g) ?? []).toHaveLength(4);
  expect(html).not.toContain('checked=""');
  expect(html).toContain('disabled=""');
});
it.each([
  { receiptId: 'a7500000-0000-4000-8000-000000000004' },
  { fingerprint: 'b'.repeat(64) },
  { epoch: 1 },
  { status: 'approved' },
  { archived: true },
  { enabled: false },
])(
  'resets the consent context when stored evidence or permissions change %#',
  (change) => {
    expect(reviewContextKey({ ...context(), ...change })).not.toBe(
      reviewContextKey(context()),
    );
    expect(EditorialReview({ ...context(), ...change }).key).not.toBe(
      EditorialReview(context()).key,
    );
  },
);
it('does not dispatch a disabled, archived or incomplete review', async () => {
  expect(
    reviewIntent('approve', { ...context(), enabled: false }, checklist(), ''),
  ).toBeNull();
  expect(
    reviewIntent('approve', { ...context(), archived: true }, checklist(), ''),
  ).toBeNull();
  await expect(
    requestReview({ ...input(), checklist: {} }),
  ).rejects.toMatchObject({ needsReload: false });
  expect(fetcher).not.toHaveBeenCalled();
});
it('binds the exact review event to its revision, fingerprint, epoch and transition', async () => {
  fetcher.mockResolvedValue(
    Response.json({ environment: 'staging', result: result() }),
  );
  expect(await requestReview(input())).toEqual(result());
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/review',
    expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify(input()),
    }),
  );
});
it.each([
  { reviewId: 'not-an-event' },
  { versionId: 'a7500000-0000-4000-8000-000000000099' },
  { fingerprint: 'b'.repeat(64) },
  { epoch: 1 },
  { status: 'published' },
  { definition: 'PRIVATE' },
])('refuses a different or excessive result field %#', async (change) => {
  const bad = { ...result(), ...change };
  expect(reviewResult(bad, input())).toBeNull();
  fetcher.mockResolvedValue(
    Response.json({ environment: 'staging', result: bad }),
  );
  await expect(requestReview(input())).rejects.toMatchObject({
    needsReload: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('requires observation after a lost response and never retries automatically', async () => {
  fetcher.mockRejectedValue(Error('lost'));
  await expect(requestReview(input())).rejects.toBeInstanceOf(
    ReviewRequestError,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  { environment: 'production', result: result() },
  { environment: 'staging', result: result(), private: 'SECRET' },
])('rejects an unbound environment or envelope %#', async (packet) => {
  fetcher.mockResolvedValue(Response.json(packet));
  await expect(requestReview(input())).rejects.toMatchObject({
    needsReload: true,
  });
});
it('distinguishes an editable validation refusal from stale or unknown state', async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({ error: 'Vérifiez les références.' }, { status: 400 }),
  );
  await expect(requestReview(input())).rejects.toMatchObject({
    needsReload: false,
  });
  fetcher.mockResolvedValueOnce(
    Response.json({ error: 'La révision a changé.' }, { status: 409 }),
  );
  await expect(requestReview(input())).rejects.toMatchObject({
    needsReload: true,
  });
  fetcher.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
  await expect(requestReview(input())).rejects.toMatchObject({
    needsReload: true,
  });
});
