import type { HistoryPoint } from '../site-data.ts';

/** A price series indexed by league day, with linear interpolation inside its range. */
export class Series {
  private readonly points: readonly HistoryPoint[];

  constructor(points: readonly HistoryPoint[]) {
    this.points = [...points].filter((p) => p[1] > 0).sort((a, b) => a[0] - b[0]);
  }

  get firstDay(): number | null {
    return this.points[0]?.[0] ?? null;
  }

  get lastDay(): number | null {
    return this.points.at(-1)?.[0] ?? null;
  }

  get length(): number {
    return this.points.length;
  }

  /** Price on `day`, linearly interpolated between known days; null outside the range. */
  priceAt(day: number): number | null {
    return this.interpolate(day, 1);
  }

  /** Volume (div) on `day`, interpolated like the price. */
  volumeAt(day: number): number | null {
    return this.interpolate(day, 2);
  }

  /** Whether a real (not interpolated) point exists on `day`. */
  has(day: number): boolean {
    return this.points.some((p) => p[0] === day);
  }

  /** Known points with `from <= day <= to`. */
  between(from: number, to: number): HistoryPoint[] {
    return this.points.filter((p) => p[0] >= from && p[0] <= to);
  }

  private interpolate(day: number, index: 1 | 2): number | null {
    const pts = this.points;
    const first = pts[0];
    const last = pts.at(-1);
    if (!first || !last || day < first[0] || day > last[0]) return null;
    // Binary search for the last point at or before `day`.
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((pts[mid]?.[0] ?? Infinity) <= day) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    if (!a || !b) return null;
    if (a[0] === day || a[0] === b[0]) return a[index];
    if (b[0] === day) return b[index];
    const t = (day - a[0]) / (b[0] - a[0]);
    return a[index] + (b[index] - a[index]) * t;
  }
}
