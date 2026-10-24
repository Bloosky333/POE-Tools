import {
  EXCHANGE_TYPE_LABELS,
  type HistoryPoint,
  type SellSignal,
  type Suggestion,
} from '@poe-tools/shared';
import { Link } from 'react-router';
import { formatMultiplier, formatPercent } from '../../lib/format.ts';
import { Amount, ItemCell, PriceChart, RatioBar, Sheet, StatCard } from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import { ActionBadge } from './ActionBadge.tsx';

interface Props {
  suggestion: Suggestion;
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceName: string;
  currentName: string;
  today: number;
  /** Market-wide current/reference price ratio today, null when unknown. */
  marketFactor: number | null;
  /** Sell Now verdict of the item, linked when it says to sell. */
  sell?: SellSignal | undefined;
  unit: UnitInfo;
  onClose: () => void;
}

export function ItemDetail(props: Props) {
  const { suggestion: s, unit } = props;
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
            <Amount value={s.item.price} unit={unit} className="text-fg" /> now ·
            <Amount value={s.item.volume} unit={unit} /> traded per day
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
        {props.sell && props.sell.verdict !== 'hold' && (
          <p className="mt-2 text-sm">
            <Link
              to={`/tools/sell-now?verdict=all&item=${encodeURIComponent(s.item.id)}`}
              className="font-medium text-accent hover:underline"
            >
              Sell Now says {props.sell.verdict === 'sell-now' ? 'sell now' : 'sell soon'} →
            </Link>
          </p>
        )}
      </div>

      <PriceChart
        reference={props.reference}
        current={props.current}
        referenceLabel={props.referenceName}
        currentLabel={props.currentName}
        today={props.today}
        unit={props.unit}
        referenceScale={props.marketFactor}
        windowFrom={ref?.buyDay}
        windowTo={ref?.sellDay}
      />

      {ref && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={`${props.referenceName} today`}>
            <Amount value={ref.priceToday} unit={unit} />
          </StatCard>
          <StatCard label={`Buy · day ${ref.buyDay}`}>
            <Amount value={ref.buyPrice} unit={unit} />
          </StatCard>
          <StatCard label={`Sell · day ${ref.sellDay}`}>
            <Amount value={ref.sellPrice} unit={unit} />
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
            <Amount value={s.projectedSellPrice} unit={unit} />
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
