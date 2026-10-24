import type { ReactNode } from 'react';

/** Standard page header: title, one-line description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full min-w-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Warning / error message box. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
      <span aria-hidden>⚠ </span>
      {children}
    </p>
  );
}

/** Placeholder rows while data loads. */
export function Skeleton({ rows = 8, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2" aria-label={label} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}
