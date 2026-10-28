import { formatPercent } from '../lib/format.ts';

/**
 * A change as a signed, colored percentage. `value` is a fraction (0.12 = +12 %), or with
 * `ratio` a ratio to 1 (1.12 = +12 %, e.g. vs the market).
 */
export function Change({ value, ratio = false }: { value: number | null; ratio?: boolean }) {
  const change = value === null ? null : ratio ? value - 1 : value;
  const tone = change === null ? 'text-subtle' : change >= 0 ? 'text-gain' : 'text-loss';
  return (
    <span className={`font-medium ${tone}`}>
      {formatPercent(change === null ? null : change * 100)}
    </span>
  );
}
