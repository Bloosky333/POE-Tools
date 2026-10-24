import type { ReactNode } from 'react';

/** Bordered surface used for every panel. */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${padded ? 'p-3' : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Card with a header row (title, optional subtitle and action) and a body. */
export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export type Tone = 'default' | 'accent' | 'gain' | 'warn' | 'loss' | 'muted';

export const TONE_TEXT: Record<Tone, string> = {
  default: '',
  accent: 'text-accent',
  gain: 'text-gain',
  warn: 'text-warn',
  loss: 'text-loss',
  muted: 'text-muted',
};

/** Key figure tile: small label, big value, optional detail line. */
export function StatTile({
  label,
  value,
  tone = 'default',
  detail,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</div>
      {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
    </div>
  );
}

/** Small labelled value, used in detail sheets. */
export function StatCard({
  label,
  tone = 'default',
  children,
}: {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${TONE_TEXT[tone]}`}>{children}</dd>
    </div>
  );
}
