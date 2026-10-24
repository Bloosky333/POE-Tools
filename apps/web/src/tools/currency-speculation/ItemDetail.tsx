import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Suggestion } from '@poe-tools/shared';
import { useEffect, type ReactNode } from 'react';
import { Div } from '../../components/Div.tsx';
import { CloseIcon } from '../../components/icons.tsx';
import { formatMultiplier } from '../../lib/format.ts';
import { ActionBadge } from './ActionBadge.tsx';
import { PriceChart } from './PriceChart.tsx';

interface Props {
  suggestion: Suggestion;
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceName: string;
  currentName: string;
  today: number;
  divineIcon: string | undefined;
  onClose: () => void;
}

export function ItemDetail(props: Props) {
  const { suggestion: s, onClose, divineIcon } = props;
  const ref = s.reference;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        aria-label={`${s.item.name} details`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            {s.item.icon && <img src={s.item.icon} alt="" className="h-10 w-10" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{s.item.name}</h2>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
              {EXCHANGE_TYPE_LABELS[s.item.type]} ·
              <Div value={s.item.price} icon={divineIcon} className="text-fg" /> now ·
              <Div value={s.item.volume} icon={divineIcon} /> traded per day
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="space-y-5 p-5">
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
            buyDay={ref?.buyDay}
            sellDay={ref?.sellDay}
          />

          {ref && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={`${props.referenceName} today`}>
                <Div value={ref.priceToday} icon={divineIcon} />
              </Stat>
              <Stat label={`Buy · day ${ref.buyDay}`}>
                <Div value={ref.buyPrice} icon={divineIcon} />
              </Stat>
              <Stat label={`Sell · day ${ref.sellDay}`}>
                <Div value={ref.sellPrice} icon={divineIcon} />
              </Stat>
              <Stat
                label="Multiplier"
                tone={ref.multiplierFromBuy >= 1 ? 'text-gain' : 'text-loss'}
              >
                {formatMultiplier(ref.multiplierFromBuy)}
              </Stat>
              <Stat label="Projected sell price">
                <Div value={s.projectedSellPrice} icon={divineIcon} />
              </Stat>
              <Stat label="Confidence">{s.confidence} / 100</Stat>
            </dl>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium">Confidence breakdown</h3>
            <div className="space-y-2">
              <Bar label="Follows the reference recently" value={s.breakdown.similarity} />
              <Bar label="Liquidity" value={s.breakdown.liquidity} />
              <Bar label="Reference data completeness" value={s.breakdown.completeness} />
            </div>
            {s.breakdown.phase < 1 && (
              <p className="mt-2 text-xs text-warn">League launch: confidence halved.</p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function Stat({
  label,
  tone = '',
  children,
}: {
  label: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${tone}`}>{children}</dd>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[1fr_8rem_2.5rem] items-center gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right text-xs text-muted">{pct}%</span>
    </div>
  );
}
