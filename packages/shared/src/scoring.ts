/*
 * Scoring shared by the speculation, Sell Now and What to Farm engines, so one change to
 * an agreed formula applies to every tool.
 */

/** Fewest items for a market-wide median to be meaningful. */
export const MARKET_MIN_ITEMS = 10;

/** League launch (days 0–3): prices are volatile, confidence is halved. */
export function launchPhase(day: number): number {
  return day <= 3 ? 0.5 : 1;
}

export interface ConfidenceParts {
  similarity: number;
  liquidity: number;
  completeness: number;
  phase: number;
}

/** 0–100: phase × (0.4 similarity + 0.35 liquidity + 0.25 completeness). */
export function confidenceOf(parts: ConfidenceParts): number {
  return Math.round(
    100 *
      parts.phase *
      (0.4 * parts.similarity + 0.35 * parts.liquidity + 0.25 * parts.completeness),
  );
}

/** Median of `values`, or null with fewer than `minCount` of them. */
export function median(values: readonly number[], minCount = MARKET_MIN_ITEMS): number | null {
  if (!values.length || values.length < minCount) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Signed whole percent of a ratio change: 0.123 → "+12%". */
export function formatPct(value: number | null): string {
  if (value === null) return '–';
  const p = Math.round(value * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
}
