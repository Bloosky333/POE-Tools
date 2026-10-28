import type { FarmSignal, FarmVerdict } from '@poe-tools/shared';
import { Badge, StyledBadge, labelsOf, type BadgeStyle } from '../../ui/index.ts';

const STYLES: Record<FarmVerdict, BadgeStyle> = {
  'farm-hold': { label: 'Farm & hold', icon: '▲', tone: 'gain' },
  'farm-sell': { label: 'Farm & sell', icon: '●', tone: 'accent' },
  thin: { label: 'Thin market', icon: '–', tone: 'neutral' },
  avoid: { label: 'Avoid', icon: '▼', tone: 'loss' },
};

export const VERDICT_LABELS = labelsOf(STYLES);

/** Verdict of a mechanic; the baseline row has none. */
export function VerdictBadge({ signal }: { signal: FarmSignal }) {
  if (!signal.verdict)
    return (
      <Badge tone="neutral" icon="≡">
        Baseline
      </Badge>
    );
  return <StyledBadge styles={STYLES} value={signal.verdict} />;
}
