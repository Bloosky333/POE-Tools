import type { FarmSignal, FarmVerdict } from '@poe-tools/shared';
import { Badge, type BadgeTone } from '../../ui/index.ts';

const STYLES: Record<FarmVerdict, { label: string; icon: string; tone: BadgeTone }> = {
  'farm-hold': { label: 'Farm & hold', icon: '▲', tone: 'gain' },
  'farm-sell': { label: 'Farm & sell', icon: '●', tone: 'accent' },
  thin: { label: 'Thin market', icon: '–', tone: 'neutral' },
  avoid: { label: 'Avoid', icon: '▼', tone: 'loss' },
};

export const VERDICT_LABELS: Record<FarmVerdict, string> = {
  'farm-hold': STYLES['farm-hold'].label,
  'farm-sell': STYLES['farm-sell'].label,
  thin: STYLES.thin.label,
  avoid: STYLES.avoid.label,
};

/** Verdict of a mechanic; the baseline row has none. */
export function VerdictBadge({ signal }: { signal: FarmSignal }) {
  if (!signal.verdict)
    return (
      <Badge tone="neutral" icon="≡">
        Baseline
      </Badge>
    );
  const style = STYLES[signal.verdict];
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {style.label}
    </Badge>
  );
}
