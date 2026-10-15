import { isFingerprint, isUuid } from './catalogue';
export const FLASHCARD_TEXT_LIMIT = 4000;
export type FlashcardValue = {
  chapterId: string;
  question: string;
  answer: string;
};
export type FlashcardItem = {
  id: string;
  chapterId: string | null;
  chapter: string;
  question: string;
  answer: string;
  createdAt: string | null;
  fingerprint: string;
};
export type FlashcardPage = {
  items: FlashcardItem[];
  total: number;
  chapters: { id: string; name: string }[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function flashcardValue(v: unknown): v is FlashcardValue {
  return (
    record(v) &&
    Object.keys(v).length === 3 &&
    Object.keys(v).every((k) =>
      ['chapterId', 'question', 'answer'].includes(k),
    ) &&
    isUuid(v.chapterId) &&
    [v.question, v.answer].every(
      (t) =>
        typeof t === 'string' &&
        t.trim().length > 0 &&
        t.length <= FLASHCARD_TEXT_LIMIT,
    )
  );
}
export type FlashcardMutation = {
  action: 'save' | 'delete';
  id: string | null;
  fingerprint: string | null;
  value: FlashcardValue | null;
};
export function flashcardMutation(v: unknown): FlashcardMutation | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 4 ||
    Object.keys(v).some(
      (k) => !['action', 'id', 'fingerprint', 'value'].includes(k),
    ) ||
    !['save', 'delete'].includes(String(v.action))
  )
    return null;
  if (
    v.id === null
      ? v.fingerprint !== null || v.action === 'delete'
      : !isUuid(v.id) || !isFingerprint(v.fingerprint)
  )
    return null;
  if (v.action === 'delete' ? v.value !== null : !flashcardValue(v.value))
    return null;
  return v as FlashcardMutation;
}
export function flashcardFilter(params: URLSearchParams) {
  const n = Number(params.get('page') ?? '1');
  return {
    query: (params.get('q') ?? '').trim().slice(0, 120),
    chapter: isUuid(params.get('chapter')) ? params.get('chapter') : null,
    page: Number.isSafeInteger(n) && n > 0 ? Math.min(n, 4001) : 1,
  };
}
export type FlashcardFragment = {
  kind: 'text' | 'math' | 'display-math';
  text: string;
};
/** Display segmentation of existing flashcard strings only; no math parsing or evaluation. */
export function flashcardFragments(text: string): FlashcardFragment[] {
  const result: FlashcardFragment[] = [];
  let position = 0;
  for (const match of text.matchAll(/\$\$[\s\S]+?\$\$|\$[^$]+?\$/g)) {
    const index = match.index!;
    if (index > position)
      result.push({ kind: 'text', text: text.slice(position, index) });
    const display = match[0].startsWith('$$');
    result.push({
      kind: display ? 'display-math' : 'math',
      text: match[0].slice(display ? 2 : 1, display ? -2 : -1),
    });
    position = index + match[0].length;
  }
  if (position < text.length)
    result.push({ kind: 'text', text: text.slice(position) });
  return result;
}
/** Insert the exact MathLive LaTeX using the delimiters already read by NovLearn. */
export function insertFlashcardMath(
  text: string,
  latex: string,
  selection: { start: number; end: number },
  display = false,
): string | null {
  if (
    !latex.trim() ||
    latex.includes('$') ||
    ![selection.start, selection.end].every(Number.isInteger) ||
    selection.start < 0 ||
    selection.end < selection.start ||
    selection.end > text.length
  )
    return null;
  const delimiter = display ? '$$' : '$';
  const result =
    text.slice(0, selection.start) +
    delimiter +
    latex +
    delimiter +
    text.slice(selection.end);
  return result.length <= FLASHCARD_TEXT_LIMIT ? result : null;
}
