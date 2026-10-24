import type { SellReason, SellSignal, SellVerdict } from '@poe-tools/shared';
import { Badge, type BadgeTone } from '../../ui/index.ts';

const STYLES: Record<SellVerdict, { label: string; icon: string; tone: BadgeTone }> = {
  'sell-now': { label: 'Sell now', icon: '▼', tone: 'loss' },
  'sell-soon': { label: 'Sell soon', icon: '◷', tone: 'warn' },
  hold: { label: 'Hold', icon: '–', tone: 'neutral' },
};

export const VERDICT_LABELS: Record<SellVerdict, string> = {
  'sell-now': STYLES['sell-now'].label,
  'sell-soon': STYLES['sell-soon'].label,
  hold: STYLES.hold.label,
};

export const SIGNAL_LABELS: Record<SellReason, string> = {
  peak: 'Peak',
  falling: 'Falling',
};

/** Verdict with its signals (Peak / Falling) or, for SELL SOON, the sell day. */
export function VerdictBadge({ signal }: { signal: SellSignal }) {
  const style = STYLES[signal.verdict];
  const detail =
    signal.verdict === 'sell-soon'
      ? `day ${signal.sellDay}`
      : signal.signals.map((s) => SIGNAL_LABELS[s]).join(' · ') || undefined;
  return (
    <Badge tone={style.tone} icon={style.icon} detail={detail}>
      {style.label}
    </Badge>
  );
}
