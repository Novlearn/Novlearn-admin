import { expect, it } from 'vitest';
import {
  clipDrawingLine,
  fitVectorDrawing,
  projectVectorCoordinates,
  type DrawingPoint,
} from '@/lib/plot-coordinates';
const window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
it.each([
  {
    from: [10000, 10000],
    to: [10001, 10001],
    expected: [
      [-5, -5],
      [5, 5],
    ],
  },
  {
    from: [10001, 10001],
    to: [10000, 10000],
    expected: [
      [5, 5],
      [-5, -5],
    ],
  },
  {
    from: [0, 10000],
    to: [0, 10001],
    expected: [
      [0, -5],
      [0, 5],
    ],
  },
  {
    from: [10000, 2],
    to: [10001, 2],
    expected: [
      [-5, 2],
      [5, 2],
    ],
  },
  {
    from: [-6, 5],
    to: [-5, 6],
    expected: [
      [-5, 6],
      [-5, 6],
    ],
    absent: true,
  },
  { from: [0, 6], to: [1, 6], expected: [], absent: true },
  {
    from: [-10, 0],
    to: [0, 10],
    expected: [
      [-5, 5],
      [-5, 5],
    ],
  },
])(
  'clips the prescribed infinite line to the actual window %#',
  ({ from, to, expected, absent }) => {
    const actual = clipDrawingLine(
      from as [number, number],
      to as [number, number],
      window,
      'line',
    );
    if (absent) expect(actual).toBeNull();
    else expect(actual).toEqual(expected);
  },
);
it('does not extend a segment whose defining points are both outside', () => {
  expect(
    clipDrawingLine([10000, 10000], [10001, 10001], window, 'segment'),
  ).toBeNull();
  expect(clipDrawingLine([-10, 0], [0, 0], window, 'segment')).toEqual([
    [-5, 0],
    [0, 0],
  ]);
  expect(clipDrawingLine([1, 1], [2, 2], window, 'segment')).toEqual([
    [1, 1],
    [2, 2],
  ]);
});
it('handles zero-length drawing data without manufacturing a line direction', () => {
  expect(clipDrawingLine([0, 0], [0, 0], window, 'line')).toBeNull();
  expect(clipDrawingLine([0, 0], [0, 0], window, 'segment')).toEqual([
    [0, 0],
    [0, 0],
  ]);
});
it('rejects nonfinite or reversed drawing windows and coordinates', () => {
  expect(clipDrawingLine([Infinity, 0], [0, 1], window, 'line')).toBeNull();
  expect(
    clipDrawingLine([0, 0], [1, 1], { ...window, xMax: -5 }, 'line'),
  ).toBeNull();
  expect(
    clipDrawingLine([0, 0], [1, 1], { ...window, yMin: NaN }, 'line'),
  ).toBeNull();
});
it('keeps clipped endpoints inside the window over translated and reversed lines', () => {
  for (let n = -12; n <= 12; n++) {
    const a: DrawingPoint = [n * 10000, n * 10000],
      b: DrawingPoint = [a[0] + 1, a[1] + 2];
    const segment = clipDrawingLine(a, b, window, 'line');
    if (!segment) continue;
    for (const [x, y] of segment) {
      expect(x).toBeGreaterThanOrEqual(-5);
      expect(x).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(-5);
      expect(y).toBeLessThanOrEqual(5);
    }
    expect(clipDrawingLine(b, a, window, 'line')).toEqual(
      [...segment].reverse(),
    );
  }
});
it('preserves 2D coordinates and projects the three spatial basis directions', () => {
  expect(projectVectorCoordinates([2, -3], 2)).toEqual([2, -3]);
  const i = projectVectorCoordinates([1, 0, 0], 3)!,
    j = projectVectorCoordinates([0, 1, 0], 3)!,
    k = projectVectorCoordinates([0, 0, 1], 3)!;
  expect(i[0]).toBeCloseTo(Math.sqrt(3) / 2);
  expect(i[1]).toBe(-0.5);
  expect(j[0]).toBeCloseTo(-Math.sqrt(3) / 2);
  expect(j[1]).toBe(-0.5);
  expect(k).toEqual([0, 1]);
  expect(projectVectorCoordinates([1, 1, 1], 3)).toEqual([0, 0]);
});
it('uses a common drawing scale, includes negatives and never divides a zero vector', () => {
  const fitted = fitVectorDrawing([
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 0],
  ])!;
  expect(fitted[1][0] - 260).toBeCloseTo(2 * (fitted[0][0] - 260));
  expect(fitted[2][0]).toBeLessThan(260);
  expect(fitted[2][1]).toBeLessThan(170);
  expect(fitted[3]).toEqual([260, 170]);
  expect(fitVectorDrawing([[0, 0]])).toEqual([[260, 170]]);
  expect(fitVectorDrawing([])).toEqual([]);
});
it('refuses a malformed vector projection and fits large finite endpoints', () => {
  expect(projectVectorCoordinates([1, 2], 3)).toBeNull();
  expect(projectVectorCoordinates([1, NaN], 2)).toBeNull();
  expect(fitVectorDrawing([[Infinity, 0]])).toBeNull();
  const points = fitVectorDrawing([
    [1e100, -1e100],
    [-1e100, 1e100],
  ])!;
  expect(points.flat().every(Number.isFinite)).toBe(true);
  for (const [x, y] of points) {
    expect(x).toBeGreaterThanOrEqual(40);
    expect(x).toBeLessThanOrEqual(480);
    expect(y).toBeGreaterThanOrEqual(40);
    expect(y).toBeLessThanOrEqual(300);
  }
});
