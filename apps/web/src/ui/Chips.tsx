import { ALL_EXCHANGE_TYPES, EXCHANGE_TYPE_LABELS, type ExchangeType } from '@poe-tools/shared';

/** Multi-option filter as pills with counts (category pickers). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            value === option.value
              ? 'border-accent bg-accent-soft text-fg'
              : 'border-line text-muted hover:border-subtle hover:text-fg'
          }`}
        >
          {option.label}
          {option.count !== undefined && <span className="text-subtle">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** "All" plus each exchange category present in `types` (one entry per row), with counts. */
export function TypeChips({
  types,
  value,
  onChange,
}: {
  types: readonly ExchangeType[];
  value: ExchangeType | 'all';
  onChange: (value: ExchangeType | 'all') => void;
}) {
  const counts = new Map<ExchangeType, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return (
    <Chips<ExchangeType | 'all'>
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', count: types.length },
        ...ALL_EXCHANGE_TYPES.filter((t) => counts.get(t)).map((t) => ({
          value: t,
          label: EXCHANGE_TYPE_LABELS[t],
          count: counts.get(t) ?? 0,
        })),
      ]}
    />
  );
}
