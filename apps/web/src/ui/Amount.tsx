import { formatAmount } from '../lib/format.ts';
import type { CurrencyView, UnitInfo } from '../lib/unit.ts';

/**
 * An amount followed by its currency icon, like poe.ninja's price cells. In a game with a
 * secondary currency (PoE 1: chaos, with divine), the converted value follows, smaller.
 */
export function Amount({
  value,
  unit,
  secondary = true,
  className = '',
}: {
  value: number | null | undefined;
  unit: UnitInfo | CurrencyView;
  /** Show the secondary currency when the unit has one. */
  secondary?: boolean;
  className?: string;
}) {
  const second = secondary && 'secondary' in unit ? unit.secondary : null;
  const converted = second && value !== null && value !== undefined ? value * second.perUnit : null;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${className}`}>
      {formatAmount(value, unit.id)}
      <CurrencyMark currency={unit} />
      {converted !== null && converted >= 0.01 && second && (
        <span className="ml-1 text-xs text-subtle" title={`${second.short} at today's rate`}>
          {formatAmount(converted, second.id)} {second.short}
        </span>
      )}
    </span>
  );
}

function CurrencyMark({ currency }: { currency: CurrencyView }) {
  return currency.icon ? (
    <img src={currency.icon} alt={currency.short} width={16} height={16} className="h-4 w-4" />
  ) : (
    <span className="text-xs text-subtle">{currency.short}</span>
  );
}
