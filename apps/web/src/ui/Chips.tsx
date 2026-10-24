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
