/** Drawing coordinates only; no formula evaluation or mathematical validation. */
export type DrawingPoint = readonly [number, number];
export type DrawingWindow = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};
export function clipDrawingLine(
  from: DrawingPoint,
  to: DrawingPoint,
  window: DrawingWindow,
  kind: 'line' | 'segment',
): [DrawingPoint, DrawingPoint] | null {
  if (
    ![...from, ...to, ...Object.values(window)].every(Number.isFinite) ||
    window.xMin >= window.xMax ||
    window.yMin >= window.yMax
  )
    return null;
  const direction = [to[0] - from[0], to[1] - from[1]];
  if (!direction.every(Number.isFinite)) return null;
  if (kind === 'line' && direction.every((n) => n === 0)) return null;
  let low = kind === 'line' ? -Infinity : 0;
  let high = kind === 'line' ? Infinity : 1;
  const ranges = [
    [window.xMin, window.xMax],
    [window.yMin, window.yMax],
  ];
  for (let axis = 0; axis < 2; axis++) {
    const [min, max] = ranges[axis],
      delta = direction[axis];
    if (delta === 0) {
      if (from[axis] < min || from[axis] > max) return null;
    } else {
      const a = (min - from[axis]) / delta,
        b = (max - from[axis]) / delta;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      if (low > high) return null;
    }
  }
  const at = (t: number): DrawingPoint => [
    Math.max(window.xMin, Math.min(window.xMax, from[0] + t * direction[0])),
    Math.max(window.yMin, Math.min(window.yMax, from[1] + t * direction[1])),
  ];
  const result: [DrawingPoint, DrawingPoint] = [at(low), at(high)];
  return result.flat().every(Number.isFinite) ? result : null;
}

/** Fixed orthographic camera for 3D; the original coordinates stay authoritative. */
export function projectVectorCoordinates(
  coordinates: readonly number[],
  dimension: 2 | 3,
): DrawingPoint | null {
  if (coordinates.length !== dimension || !coordinates.every(Number.isFinite))
    return null;
  const [x, y, z] = coordinates;
  const point: DrawingPoint =
    dimension === 2 ? [x, y] : [((x - y) * Math.sqrt(3)) / 2, z - (x + y) / 2];
  return point.every(Number.isFinite) ? point : null;
}

/** One common scale preserves the relative lengths of projected arrows. */
export function fitVectorDrawing(
  points: readonly DrawingPoint[],
): DrawingPoint[] | null {
  if (!points.every((p) => p.every(Number.isFinite))) return null;
  const maxX = Math.max(0, ...points.map((p) => Math.abs(p[0])));
  const maxY = Math.max(0, ...points.map((p) => Math.abs(p[1])));
  const scale = Math.min(
    maxX ? 210 / maxX : Infinity,
    maxY ? 120 / maxY : Infinity,
  );
  const factor = Number.isFinite(scale) ? scale : 1;
  const fitted = points.map(
    ([x, y]): DrawingPoint => [260 + x * factor, 170 - y * factor],
  );
  return fitted.every((p) => p.every(Number.isFinite)) ? fitted : null;
}
