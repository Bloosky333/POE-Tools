import type { Action } from '@poe-tools/shared';
import { StyledBadge, labelsOf, type BadgeStyle } from '../../ui/index.ts';

const STYLES: Record<Action, BadgeStyle> = {
  buy: { label: 'Buy now', icon: '▲', tone: 'gain' },
  wait: { label: 'Wait', icon: '◷', tone: 'warn' },
  avoid: { label: 'Avoid', icon: '▼', tone: 'loss' },
  neutral: { label: 'Neutral', icon: '–', tone: 'neutral' },
};

export const ACTION_LABELS = labelsOf(STYLES);

export function ActionBadge({ action, detail }: { action: Action; detail?: string | undefined }) {
  return <StyledBadge styles={STYLES} value={action} detail={detail} />;
}
