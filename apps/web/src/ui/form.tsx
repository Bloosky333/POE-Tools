import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { SearchIcon } from '../components/icons.tsx';

export const controlClass =
  'h-8 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg outline-none hover:border-subtle focus-visible:border-accent';

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative w-full sm:w-auto">
      <span className="sr-only">{placeholder}</span>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-subtle"
        width={15}
        height={15}
      />
      <input
        type="search"
        placeholder={placeholder}
        className={`${controlClass} w-full pl-7 sm:w-56`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Label + control (+ unit) on one line, for filter bars. */
export function InlineField({
  label,
  unit,
  children,
}: {
  label: string;
  unit?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {unit && <span className="text-xs text-subtle">{unit}</span>}
    </label>
  );
}

/** Row of filter controls. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">{children}</div>;
}
