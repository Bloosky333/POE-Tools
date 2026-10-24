import type { Action } from '@poe-tools/shared';
import { Badge, type BadgeTone } from '../../ui/index.ts';

const STYLES: Record<Action, { label: string; icon: string; tone: BadgeTone }> = {
  buy: { label: 'Buy now', icon: '▲', tone: 'gain' },
  wait: { label: 'Wait', icon: '◷', tone: 'warn' },
  avoid: { label: 'Avoid', icon: '▼', tone: 'loss' },
  neutral: { label: 'Neutral', icon: '–', tone: 'neutral' },
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
    <Badge tone={style.tone} icon={style.icon} detail={detail}>
      {style.label}
    </Badge>
  );
}
