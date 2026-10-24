import type { Action } from '@poe-tools/shared';

const STYLES: Record<Action, { label: string; icon: string; className: string }> = {
  buy: { label: 'Buy now', icon: '▲', className: 'bg-gain-soft text-gain' },
  wait: { label: 'Wait', icon: '◷', className: 'bg-warn-soft text-warn' },
  avoid: { label: 'Avoid', icon: '▼', className: 'bg-loss-soft text-loss' },
  neutral: { label: 'Neutral', icon: '–', className: 'bg-surface-2 text-muted' },
};

export const ACTION_LABELS: Record<Action, string> = {
  buy: STYLES.buy.label,
  wait: STYLES.wait.label,
  avoid: STYLES.avoid.label,
  neutral: STYLES.neutral.label,
};

export function ActionBadge({ action, detail }: { action: Action; detail?: string | undefined }) {
  const style = STYLES[action];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${style.className}`}
    >
      <span aria-hidden className="text-[10px]">
        {style.icon}
      </span>
      {style.label}
      {detail && <span className="font-normal opacity-80">{detail}</span>}
    </span>
  );
}
