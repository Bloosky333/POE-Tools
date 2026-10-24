import { formatPercent } from '../../lib/format.ts';

/** A ratio vs the market (1 = like the market) as a signed, colored percentage. */
export function RatioChange({ value }: { value: number | null }) {
  const tone = value === null ? 'text-subtle' : value >= 1 ? 'text-gain' : 'text-loss';
  return (
    <span className={`font-medium ${tone}`}>
      {formatPercent(value === null ? null : (value - 1) * 100)}
    </span>
  );
}
