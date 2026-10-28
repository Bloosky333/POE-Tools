import type { ReactNode } from 'react';

export type BadgeTone = 'gain' | 'warn' | 'loss' | 'neutral' | 'accent';

const TONES: Record<BadgeTone, string> = {
  gain: 'bg-gain-soft text-gain',
  warn: 'bg-warn-soft text-warn',
  loss: 'bg-loss-soft text-loss',
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
};

/**
 * Status pill. Always pair the tone with an icon or words: color is never the only
 * signal.
 */
export function Badge({
  tone,
  icon,
  children,
  detail,
}: {
  tone: BadgeTone;
  icon?: string;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {icon && (
        <span aria-hidden className="text-[10px]">
          {icon}
        </span>
      )}
      {children}
      {detail && <span className="font-normal opacity-80">{detail}</span>}
    </span>
  );
}

/** Label, icon and tone of one value of a verdict-like enum. */
export interface BadgeStyle {
  label: string;
  icon: string;
  tone: BadgeTone;
}

/** Badge of `value` from a `BadgeStyle` table. */
export function StyledBadge<K extends string>({
  styles,
  value,
  detail,
}: {
  styles: Record<K, BadgeStyle>;
  value: K;
  detail?: ReactNode;
}) {
  const style = styles[value];
  return (
    <Badge tone={style.tone} icon={style.icon} detail={detail}>
      {style.label}
    </Badge>
  );
}

/** The labels of a `BadgeStyle` table (filters, legends). */
export function labelsOf<K extends string>(styles: Record<K, BadgeStyle>): Record<K, string> {
  return Object.fromEntries(
    Object.entries<BadgeStyle>(styles).map(([key, style]) => [key, style.label]),
  ) as Record<K, string>;
}

/** Rounded status label (Beta, Coming soon…). */
export function Pill({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
