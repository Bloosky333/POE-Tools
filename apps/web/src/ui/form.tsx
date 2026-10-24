import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
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

const BUTTON_VARIANTS = {
  primary: 'border-accent bg-accent text-on-accent hover:opacity-90',
  secondary: 'border-line bg-surface-2 text-fg hover:border-subtle',
  ghost: 'border-transparent text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'border-transparent text-loss hover:bg-loss-soft',
} as const;

/** Action button (`primary` for the main action of a view, `ghost` for row actions). */
export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Multi-line text input. */
export function TextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-16 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none hover:border-subtle focus-visible:border-accent ${className}`}
      {...props}
    />
  );
}

/** Label above a control, for forms. */
export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  );
}
