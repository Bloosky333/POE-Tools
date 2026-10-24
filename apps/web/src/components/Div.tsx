import { formatDiv } from '../lib/format.ts';

/** A divine amount followed by the Divine Orb icon, like poe.ninja's price cells. */
export function Div({
  value,
  icon,
  className = '',
}: {
  value: number | null | undefined;
  icon?: string | undefined;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${className}`}>
      {formatDiv(value)}
      {icon ? (
        <img src={icon} alt="div" width={16} height={16} className="h-4 w-4" />
      ) : (
        <span className="text-xs text-subtle">div</span>
      )}
    </span>
  );
}
