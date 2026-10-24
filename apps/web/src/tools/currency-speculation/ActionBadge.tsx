import type { Action } from '@poe-tools/shared';

const STYLES: Record<Action, { label: string; icon: string; className: string }> = {
  buy: {
    label: 'Buy now',
    icon: '▲',
    className: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300',
  },
  wait: {
    label: 'Wait',
    icon: '◷',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  avoid: {
    label: 'Avoid',
    icon: '▼',
    className: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
  neutral: {
    label: 'Neutral',
    icon: '–',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

export const ACTION_LABELS: Record<Action, string> = {
  buy: STYLES.buy.label,
  wait: STYLES.wait.label,
  avoid: STYLES.avoid.label,
  neutral: STYLES.neutral.label,
};

export function ActionBadge({ action }: { action: Action }) {
  const style = STYLES[action];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${style.className}`}
    >
      <span aria-hidden>{style.icon}</span>
      {style.label}
    </span>
  );
}
