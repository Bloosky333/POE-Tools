import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Suggestion } from '@poe-tools/shared';
import { formatMultiplier, formatPercent } from '../../lib/format.ts';
import { Div, ItemCell, RatioBar, Sheet, StatCard } from '../../ui/index.ts';
import { ActionBadge } from './ActionBadge.tsx';
import { PriceChart } from './PriceChart.tsx';

interface Props {
  suggestion: Suggestion;
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceName: string;
  currentName: string;
  today: number;
  /** Market-wide current/reference price ratio today, null when unknown. */
  marketFactor: number | null;
  divineIcon: string | undefined;
  onClose: () => void;
}

export function ItemDetail(props: Props) {
  const { suggestion: s, divineIcon } = props;
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
        <ActionBadge
          action={s.action}
          detail={s.action === 'wait' && ref ? `day ${ref.buyDay}` : undefined}
        />
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
        referenceScale={props.marketFactor}
        buyDay={ref?.buyDay}
        sellDay={ref?.sellDay}
      />

      {ref && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={`${props.referenceName} today`}>
            <Div value={ref.priceToday} icon={divineIcon} />
          </StatCard>
          <StatCard label={`Buy · day ${ref.buyDay}`}>
            <Div value={ref.buyPrice} icon={divineIcon} />
          </StatCard>
          <StatCard label={`Sell · day ${ref.sellDay}`}>
            <Div value={ref.sellPrice} icon={divineIcon} />
          </StatCard>
          <StatCard label="Last league ×" tone={ref.multiplierFromBuy >= 1 ? 'gain' : 'loss'}>
            {formatMultiplier(ref.multiplierFromBuy)}
          </StatCard>
          <StatCard
            label="Premium vs market"
            tone={ref.premium === null ? 'default' : ref.premium > 1 ? 'loss' : 'gain'}
          >
            {ref.premium === null ? '–' : formatPercent((ref.premium - 1) * 100)}
          </StatCard>
          <StatCard label="Expected ×" tone={ref.expectedMultiplier >= 1 ? 'gain' : 'loss'}>
            {formatMultiplier(ref.expectedMultiplier)}
          </StatCard>
          <StatCard label="Projected sell price">
            <Div value={s.projectedSellPrice} icon={divineIcon} />
          </StatCard>
          <StatCard label="Confidence">{s.confidence} / 100</StatCard>
        </dl>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">Confidence breakdown</h3>
        <div className="space-y-2">
          <RatioBar label="Follows the reference recently" value={s.breakdown.similarity} />
          <RatioBar label="Liquidity" value={s.breakdown.liquidity} />
          <RatioBar label="Reference data completeness" value={s.breakdown.completeness} />
        </div>
        {s.breakdown.phase < 1 && (
          <p className="mt-2 text-xs text-warn">League launch: confidence halved.</p>
        )}
      </section>
    </Sheet>
  );
}
