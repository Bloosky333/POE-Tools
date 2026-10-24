import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type SellSignal } from '@poe-tools/shared';
import { formatPercent } from '../../lib/format.ts';
import { Div, ItemCell, PriceChart, RatioBar, Sheet, StatCard, type Tone } from '../../ui/index.ts';
import { VerdictBadge } from './VerdictBadge.tsx';

interface Props {
  signal: SellSignal;
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceName: string;
  currentName: string;
  today: number;
  divineIcon: string | undefined;
  onClose: () => void;
}

const pct = (ratio: number | null) => formatPercent(ratio === null ? null : ratio * 100);

export function SellDetail(props: Props) {
  const { signal: s, divineIcon } = props;
  const ref = s.reference;

  return (
    <Sheet
      label={`${s.item.name} details`}
      onClose={props.onClose}
      header={
        <>
          <ItemCell icon={s.item.icon} name={s.item.name} size="lg" />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {EXCHANGE_TYPE_LABELS[s.item.type]} ·
            <Div value={s.item.price} icon={divineIcon} className="text-fg" /> now ·
            <Div value={s.item.volume} icon={divineIcon} /> traded per day
          </p>
        </>
      }
    >
      <div className="rounded-lg bg-surface-2 p-3">
        <VerdictBadge signal={s} />
        <ul className="mt-2 space-y-0.5 text-sm text-muted">
          {s.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <PriceChart
        reference={props.reference}
        current={props.current}
        referenceLabel={props.referenceName}
        currentLabel={props.currentName}
        today={props.today}
        windowFrom={ref && s.signals.includes('peak') ? ref.peakDay : undefined}
        windowTo={ref && s.signals.includes('peak') ? ref.horizonDay : undefined}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="1 day" tone={tone(s.change[1])}>
          {pct(s.change[1])}
        </StatCard>
        <StatCard label="3 days" tone={tone(s.change[3])}>
          {pct(s.change[3])}
        </StatCard>
        <StatCard label="7 days" tone={tone(s.change[7])}>
          {pct(s.change[7])}
        </StatCard>
        <StatCard label="3 days vs market" tone={tone(s.adjustedChange[3])}>
          {pct(s.adjustedChange[3])}
        </StatCard>
        <StatCard label="vs league high">
          {pct(s.fromHigh === null ? null : s.fromHigh - 1)}
        </StatCard>
        {ref && (
          <>
            <StatCard label={`${props.referenceName} today`}>
              <Div value={ref.priceToday} icon={divineIcon} />
            </StatCard>
            <StatCard label={`Last league peak · day ${ref.peakDay}`}>
              <Div value={ref.peakPrice} icon={divineIcon} />
            </StatCard>
            <StatCard label={`Last league · day ${ref.horizonDay}`} tone={tone(ref.change - 1)}>
              {pct(ref.change - 1)}
            </StatCard>
          </>
        )}
        <StatCard label="Expected loss if held" tone={s.expectedLoss > 0 ? 'loss' : 'default'}>
          {s.expectedLoss > 0 ? pct(-s.expectedLoss) : '–'}
        </StatCard>
        <StatCard label="Confidence">{s.confidence} / 100</StatCard>
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-medium">Confidence breakdown</h3>
        <div className="space-y-2">
          <RatioBar label="Follows the reference recently" value={s.breakdown.similarity} />
          <RatioBar label="Liquidity" value={s.breakdown.liquidity} />
          <RatioBar label="Data completeness" value={s.breakdown.completeness} />
        </div>
        {s.breakdown.phase < 1 && (
          <p className="mt-2 text-xs text-warn">League launch: confidence halved.</p>
        )}
      </section>
    </Sheet>
  );
}

function tone(change: number | null): Tone {
  return change === null ? 'default' : change >= 0 ? 'gain' : 'loss';
}
