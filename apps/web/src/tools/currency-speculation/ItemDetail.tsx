import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Suggestion } from '@poe-tools/shared';
import { useEffect } from 'react';
import { formatDiv, formatMultiplier } from '../../lib/format.ts';
import { ActionBadge } from './ActionBadge.tsx';
import { PriceChart } from './PriceChart.tsx';

interface Props {
  suggestion: Suggestion;
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceName: string;
  currentName: string;
  today: number;
  onClose: () => void;
}

export function ItemDetail(props: Props) {
  const { suggestion: s, onClose } = props;
  const ref = s.reference;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={`${s.item.name} details`}
      className="fixed inset-y-0 right-0 z-20 w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-950"
    >
      <header className="mb-4 flex items-start gap-3">
        {s.item.icon && <img src={s.item.icon} alt="" className="h-10 w-10" />}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{s.item.name}</h2>
          <p className="text-sm text-gray-500">
            {EXCHANGE_TYPE_LABELS[s.item.type]} · {formatDiv(s.item.price)} div now ·{' '}
            {formatDiv(s.item.volume)} div/day traded
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ✕
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ActionBadge action={s.action} />
        <span className="text-sm text-gray-600 dark:text-gray-300">{s.reasons.join(' · ')}</span>
      </div>

      <PriceChart
        reference={props.reference}
        current={props.current}
        referenceLabel={props.referenceName}
        currentLabel={props.currentName}
        today={props.today}
        buyDay={ref?.buyDay}
        sellDay={ref?.sellDay}
      />

      {ref && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Stat label={`${props.referenceName} today`} value={`${formatDiv(ref.priceToday)} div`} />
          <Stat label={`Buy (day ${ref.buyDay})`} value={`${formatDiv(ref.buyPrice)} div`} />
          <Stat label={`Sell (day ${ref.sellDay})`} value={`${formatDiv(ref.sellPrice)} div`} />
          <Stat label="Multiplier" value={formatMultiplier(ref.multiplierFromBuy)} />
          <Stat label="Projected sell" value={`${formatDiv(s.projectedSellPrice)} div`} />
          <Stat label="Confidence" value={`${s.confidence} / 100`} />
        </dl>
      )}

      <section className="mt-4 text-sm">
        <h3 className="mb-1 font-medium">Confidence breakdown</h3>
        <ul className="space-y-0.5 text-gray-600 dark:text-gray-300">
          <li>Follows the reference recently: {Math.round(s.breakdown.similarity * 100)}%</li>
          <li>Liquidity: {Math.round(s.breakdown.liquidity * 100)}%</li>
          <li>Reference data completeness: {Math.round(s.breakdown.completeness * 100)}%</li>
          {s.breakdown.phase < 1 && <li>League launch: confidence halved</li>}
        </ul>
      </section>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
