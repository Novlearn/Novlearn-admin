import { describe, expect, it } from 'vitest';
import {
  catalogueSyncCandidate,
  catalogueSyncInspection,
  catalogueSyncPayload,
  catalogueSyncPage,
  catalogueSyncReceipt,
  catalogueSyncReceiptMatches,
  catalogueSyncTargetErrorClass,
} from '@/lib/catalogue-sync';

const chapter = 'f1000000-0000-4000-8000-000000000001';
const exercise = 'f4000000-0000-4000-8000-000000000001';
const flashcard = 'f3000000-0000-4000-8000-000000000001';
const fp = 'a'.repeat(64);

describe('catalogue synchronization contracts', () => {
  it('accepts only bounded, stable source candidates and inspection snapshots', () => {
    const item = {
      sortKey: `chapter:${chapter}`,
      kind: 'chapter',
      catalogId: chapter,
      status: 'ready',
      fingerprint: fp,
    };
    expect(catalogueSyncCandidate(item)).toBe(true);
    expect(catalogueSyncCandidate({ ...item, status: 'draft' })).toBe(false);
    expect(catalogueSyncCandidate({ ...item, fingerprint: null })).toBe(false);
    expect(
      catalogueSyncPage({
        items: [
          item,
          {
            ...item,
            kind: 'flashcard',
            catalogId: flashcard,
            sortKey: `flashcard:${flashcard}`,
            status: 'blocked',
            fingerprint: null,
          },
        ],
        limit: 100,
        next: null,
      })?.items,
    ).toHaveLength(2);
    expect(
      catalogueSyncPage({ items: [item], limit: 100, next: null })?.items,
    ).toHaveLength(1);
    expect(
      catalogueSyncPage({ items: [item, item], limit: 100, next: null }),
    ).toBeNull();
    expect(catalogueSyncInspection({ stateToken: fp })).toEqual({
      stateToken: fp,
    });
    expect(catalogueSyncInspection({ stateToken: fp, extra: true })).toBeNull();
  });

  it('supports archived exercise projections without inventing an upsert payload', () => {
    const archived = {
      kind: 'exercise',
      catalogId: exercise,
      action: 'archive',
      fingerprint: fp,
      versionId: null,
      revision: null,
      dependencies: [],
    };
    expect(catalogueSyncPayload(archived)).not.toBeNull();
    expect(catalogueSyncPayload({ ...archived, action: 'upsert' })).toBeNull();
  });

  it('requires every planned item to appear exactly once in a valid target receipt', () => {
    const chapterPayload = catalogueSyncPayload({
      kind: 'chapter',
      catalogId: chapter,
      action: 'upsert',
      fingerprint: fp,
      dependencies: [],
      data: { catalogId: chapter, name: 'Chapitre A' },
    })!;
    const flashcardPayload = catalogueSyncPayload({
      kind: 'flashcard',
      catalogId: flashcard,
      action: 'upsert',
      fingerprint: 'b'.repeat(64),
      dependencies: [{ kind: 'chapter', catalogId: chapter }],
      data: {
        catalogId: flashcard,
        chapterCatalogId: chapter,
        question: 'Q',
        answer: 'R',
      },
    })!;
    const exercisePayload = catalogueSyncPayload({
      kind: 'exercise',
      catalogId: exercise,
      action: 'upsert',
      fingerprint: 'c'.repeat(64),
      versionId: 'f6000000-0000-4000-8000-000000000001',
      revision: '2',
      dependencies: [],
      data: { catalogId: exercise, revision: 2, definition: {}, header: {} },
    })!;
    const batchId = 'f5000000-0000-4000-8000-000000000001';
    const receipt = catalogueSyncReceipt(
      {
        batchId,
        stateToken: 'd'.repeat(64),
        items: [
          {
            kind: 'chapter',
            catalogId: chapter,
            fingerprint: fp,
            targetId: '1',
            result: 'applied',
          },
          {
            kind: 'flashcard',
            catalogId: flashcard,
            fingerprint: 'b'.repeat(64),
            targetId: '2',
            result: 'applied',
          },
          {
            kind: 'exercise',
            catalogId: exercise,
            fingerprint: 'c'.repeat(64),
            targetId: '3',
            result: 'applied',
          },
        ],
      },
      batchId,
    )!;
    expect(
      catalogueSyncReceiptMatches(receipt, [
        chapterPayload,
        flashcardPayload,
        exercisePayload,
      ]),
    ).toBe(true);
    expect(
      catalogueSyncReceiptMatches(receipt, [chapterPayload, exercisePayload]),
    ).toBe(false);
    expect(
      catalogueSyncReceiptMatches(receipt, [
        { ...flashcardPayload, fingerprint: fp },
      ]),
    ).toBe(false);
    expect(
      catalogueSyncReceipt(
        {
          batchId,
          stateToken: 'd'.repeat(64),
          items: receipt.items.slice(0, 2),
        },
        batchId,
      ),
    ).not.toBeNull();
  });

  it('keeps target rejection and stale inspection separate from success', () => {
    expect(catalogueSyncTargetErrorClass('23503')).toBe('blocked');
    expect(catalogueSyncTargetErrorClass('40001')).toBe('conflict');
    expect(catalogueSyncTargetErrorClass(null)).toBe('unavailable');
  });
});
