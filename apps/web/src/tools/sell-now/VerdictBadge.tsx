import { relativeDay, type SellReason, type SellSignal, type SellVerdict } from '@poe-tools/shared';
import { StyledBadge, labelsOf, type BadgeStyle } from '../../ui/index.ts';

const STYLES: Record<SellVerdict, BadgeStyle> = {
  'sell-now': { label: 'Sell now', icon: '▼', tone: 'loss' },
  'sell-soon': { label: 'Sell soon', icon: '◷', tone: 'warn' },
  hold: { label: 'Hold', icon: '–', tone: 'neutral' },
};

export const VERDICT_LABELS = labelsOf(STYLES);

export const SIGNAL_LABELS: Record<SellReason, string> = {
  peak: 'Peak',
  falling: 'Falling',
};

/** Verdict with its signals (Peak / Falling) or, for SELL SOON, when to sell ("in 3 days"). */
export function VerdictBadge({ signal, today }: { signal: SellSignal; today: number }) {
  const detail =
    signal.verdict === 'sell-soon'
      ? relativeDay(signal.sellDay ?? today, today)
      : signal.signals.map((s) => SIGNAL_LABELS[s]).join(' · ') || undefined;
  return <StyledBadge styles={STYLES} value={signal.verdict} detail={detail} />;
}
