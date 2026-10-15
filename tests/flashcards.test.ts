import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  flashcardValue,
  flashcardMutation,
  flashcardFilter,
  flashcardFragments,
  insertFlashcardMath,
} from '@/lib/flashcards';
import { FlashcardContent } from '@/components/flashcard-preview';
const id = 'a5800000-0000-4000-8000-000000000001';
const value = {
  chapterId: id,
  question: 'Quelle dérivée pour $x^2$ ?',
  answer: '  $2x$\nJustification  ',
};
const save = { action: 'save', id: null, fingerprint: null, value };
describe('Flashcards : champs et transport existant', () => {
  it('renders mixed text and a readonly LaTeX fallback during SSR', () => {
    const html = renderToStaticMarkup(
      createElement(FlashcardContent, { text: String.raw`Valeur $\frac12$.` }),
    );
    expect(html).toContain('Valeur');
    expect(html).toContain('readonly=""');
    expect(html).toContain(String.raw`\frac12`);
    expect(html).not.toContain('<span class="math-display');
  });
  it('preserves literal strings without normalization or math evaluation', () => {
    expect(flashcardValue(value)).toBe(true);
    expect(flashcardMutation(save)?.value).toEqual(value);
  });
  it.each([
    { ...save, environment: 'production' },
    { ...save, actor_id: id },
    { ...save, action: 'publish' },
    { ...save, id },
    { ...save, value: { ...value, id } },
    { ...save, value: { ...value, question: ' ' } },
    { ...save, value: { ...value, answer: 'x'.repeat(4001) } },
    { ...save, value: { ...value, chapterId: 'unresolved' } },
  ])('refuses invalid or privileged input %#', (body) =>
    expect(flashcardMutation(body)).toBeNull(),
  );
  it('requires a current fingerprint and explicit null content for deletion', () => {
    expect(flashcardMutation({ ...save, action: 'delete' })).toBeNull();
    expect(
      flashcardMutation({
        action: 'delete',
        id,
        fingerprint: 'a'.repeat(64),
        value: null,
      }),
    ).not.toBeNull();
  });
  it('bounds filters and keeps literal wildcard characters', () => {
    expect(
      flashcardFilter(new URLSearchParams('q=%25_&page=-2&chapter=legacy')),
    ).toEqual({ query: '%_', page: 1, chapter: null });
  });
  it('segments the existing text and dollar delimiters, including multiline blocks', () => {
    expect(flashcardFragments('Texte $x^2$ puis $$a\nb$$ fin')).toEqual([
      { kind: 'text', text: 'Texte ' },
      { kind: 'math', text: 'x^2' },
      { kind: 'text', text: ' puis ' },
      { kind: 'display-math', text: 'a\nb' },
      { kind: 'text', text: ' fin' },
    ]);
  });
  it('retains incomplete delimiters as literal text', () => {
    expect(flashcardFragments('Coût : $5')).toEqual([
      { kind: 'text', text: 'Coût : $5' },
    ]);
  });
  it('inserts exact MathLive LaTeX at the selected text', () => {
    expect(
      insertFlashcardMath('Valeur ?', String.raw`\frac12`, {
        start: 7,
        end: 8,
      }),
    ).toBe(String.raw`Valeur $\frac12$`);
    expect(
      insertFlashcardMath('', String.raw`1{,}25`, { start: 0, end: 0 }, true),
    ).toBe(String.raw`$$1{,}25$$`);
  });
  it.each(['', '$x$', ' '.repeat(4)])(
    'refuses empty or already delimited scratch expressions %s',
    (latex) =>
      expect(insertFlashcardMath('', latex, { start: 0, end: 0 })).toBeNull(),
  );
  it('rejects out-of-range selection and overflow without truncation', () => {
    expect(insertFlashcardMath('abc', 'x', { start: 4, end: 4 })).toBeNull();
    expect(
      insertFlashcardMath('x'.repeat(4000), 'y', { start: 4000, end: 4000 }),
    ).toBeNull();
  });
  it('escapes HTML in text and keeps unclosed math literal in SSR', () => {
    const html = renderToStaticMarkup(
      createElement(FlashcardContent, {
        text: '<script>alert(1)</script> $unclosed',
      }),
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('$unclosed');
  });
});
