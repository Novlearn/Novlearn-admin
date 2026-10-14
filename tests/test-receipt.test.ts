import { expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
vi.mock('server-only', () => ({}));
import {
  readTestSigningConfiguration,
  signTestReceipt,
} from '@/lib/test-receipt';
const config = readTestSigningConfiguration({
  ADMIN_TEST_SIGNING_KEY_ID: '10000000-0000-4000-8000-000000000001',
  ADMIN_TEST_SIGNING_KEY: '42'.repeat(32),
})!;
const input = {
  actorId: '20000000-0000-4000-8000-000000000001',
  versionId: '30000000-0000-4000-8000-000000000001',
  fingerprint: 'a'.repeat(64),
  epoch: 2,
  cases: [],
  report: {
    definitionDigest: 'b'.repeat(64),
    engineVersion: '0.1.0',
    passed: false,
    complete: true,
    seeds: [],
  },
};
it('reste fermé sans secret serveur complet, même avec une variable publique', () => {
  expect(readTestSigningConfiguration({})).toBeNull();
  expect(
    readTestSigningConfiguration({
      NEXT_PUBLIC_ADMIN_TEST_SIGNING_KEY: '42'.repeat(32),
    }),
  ).toBeNull();
  expect(
    readTestSigningConfiguration({
      ADMIN_TEST_SIGNING_KEY_ID: config.id,
      ADMIN_TEST_SIGNING_KEY: 'bad',
    }),
  ).toBeNull();
});
it('signe les octets UTF8 complets avec révision, acteur, état et archive, sans exposer la clé', () => {
  const signed = signTestReceipt(config, input, 1000000);
  const body = JSON.parse(signed.payload);
  expect(body.issuedAt).toBe(1000);
  expect(body.versionId).toBe(input.versionId);
  expect(body.epoch).toBe(2);
  expect(body.engineArchiveSha256).toBe(
    '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290',
  );
  expect(signed.signature).toBe(
    createHmac('sha256', config.key)
      .update(signed.payload, 'utf8')
      .digest('hex'),
  );
  expect(signed.payload).not.toContain(config.key.toString('hex'));
  const altered = signed.payload.replace('"epoch":2', '"epoch":3');
  expect(
    createHmac('sha256', config.key).update(altered, 'utf8').digest('hex'),
  ).not.toBe(signed.signature);
});
it('crée une identité distincte et refuse un reçu dépassant la limite SQL', () => {
  expect(JSON.parse(signTestReceipt(config, input).payload).receiptId).not.toBe(
    JSON.parse(signTestReceipt(config, input).payload).receiptId,
  );
  expect(() =>
    signTestReceipt(config, {
      ...input,
      cases: [
        {
          questionId: 'q',
          answer: { format: 'text', source: 'x'.repeat(262145) },
          expectedState: 'incorrect',
        },
      ],
    }),
  ).toThrow('Receipt limit');
});
