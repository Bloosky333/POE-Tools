import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
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
        aria-keyshortcuts="/"
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
  unit?: string | undefined;
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

/**
 * Number input that keeps what is typed while editing: a valid number (within
 * `min`…`max`, whole with `integer`) is passed on at once, anything else (e.g. an emptied
 * field) waits, and leaving the field shows the last valid value again.
 */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  integer = false,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
  integer?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={props.step ?? (integer ? 1 : 'any')}
      className={`${controlClass} ${className}`}
      value={text ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        const valid =
          raw.trim() !== '' &&
          Number.isFinite(n) &&
          (min === undefined || n >= min) &&
          (max === undefined || n <= max) &&
          (!integer || Number.isInteger(n));
        if (valid) onChange(n);
      }}
      onBlur={(e) => {
        setText(null);
        props.onBlur?.(e);
      }}
    />
  );
}

/** Numeric filter (≥ `min`) with its label and unit, for filter bars. */
export function NumberField({
  label,
  unit,
  value,
  step,
  min = 0,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <InlineField label={label} unit={unit}>
      <NumericInput min={min} step={step} className="w-20" value={value} onChange={onChange} />
    </InlineField>
  );
}
