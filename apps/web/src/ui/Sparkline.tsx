import type { HistoryPoint } from '@poe-tools/shared';

/** Tiny trend line of the last days; colored by direction (also stated by the % next to it). */
export function Sparkline({
  points,
  width = 72,
  height = 22,
}: {
  points: readonly HistoryPoint[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const prices = points.map((p) => p[1]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = prices
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`,
    )
    .join('');
  const up = (prices.at(-1) ?? 0) >= (prices[0] ?? 0);
  return (
    <svg width={width} height={height} aria-hidden className={up ? 'text-gain' : 'text-loss'}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
