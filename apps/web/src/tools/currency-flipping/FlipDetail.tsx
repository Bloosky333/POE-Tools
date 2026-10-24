import {
  EXCHANGE_TYPE_LABELS,
  type CurrentItem,
  type Flip,
  type FlipLeg,
  type Hub,
} from '@poe-tools/shared';
import { Amount, ItemCell, Sheet, StatCard } from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import type { FlipRow } from './logic.ts';
import {
  HUB_NAMES,
  HUB_SHORT,
  KindBadge,
  OrderRatio,
  formatMargin,
  quotePrices,
} from './parts.tsx';

interface Props {
  row: FlipRow;
  hours: readonly number[];
  minMargin: number;
  hubIcons: Partial<Record<Hub, string>>;
  unit: UnitInfo;
  onClose: () => void;
}

export function FlipDetail({ row, hours, minMargin, hubIcons, unit, onClose }: Props) {
  const { flip, item } = row;
  const name = item?.name ?? flip.item;
  const prices = quotePrices(flip);

  return (
    <Sheet
      label={`${name} flip details`}
      onClose={onClose}
      header={
        <>
          <ItemCell icon={item?.icon} name={name} size="lg" />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <KindBadge flip={flip} />
            {item && EXCHANGE_TYPE_LABELS[item.type]}
          </p>
        </>
      }
    >
      <section className="rounded-lg bg-surface-2 p-3">
        <h3 className="mb-2 text-sm font-medium">Orders to place</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Buy{' '}
            <OrderRatio
              side="buy"
              price={prices.buy}
              hub={flip.buy.hub}
              item={item}
              hubIcons={hubIcons}
            />
          </li>
          <li>
            Sell{' '}
            <OrderRatio
              side="sell"
              price={prices.sell}
              hub={flip.sell.hub}
              item={item}
              hubIcons={hubIcons}
            />
          </li>
          {flip.convert && <ConvertStep convert={flip.convert} hubIcons={hubIcons} />}
        </ol>
        <p className="mt-2 text-xs text-muted">
          {flip.kind === 'spread'
            ? 'Buy at the low end and sell at the high end of the last hour’s range.'
            : 'Ratios are last hour’s average prices; check the live order book before placing.'}
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Margin (last hour)" tone="gain">
          {formatMargin(flip.margin)}
        </StatCard>
        <StatCard label="Best case (range ends)">{formatMargin(flip.bestMargin)}</StatCard>
        <StatCard label={`Hours ≥ ${minMargin}%`}>{row.recurrence}%</StatCard>
        <StatCard label="Volume 24 h (thinnest leg)">
          {flip.units24h.toLocaleString('en-US')} items
        </StatCard>
        <StatCard label="Value 24 h (thinnest leg)">
          <Amount value={flip.value24h} unit={unit} />
        </StatCard>
      </dl>

      <HourlyMargins hourly={flip.hourly} hours={hours} minMargin={minMargin} />

      <section>
        <h3 className="mb-2 text-sm font-medium">Markets (last hour)</h3>
        <div className="space-y-2">
          <LegRow label="Buy" leg={flip.buy} item={item} hubIcons={hubIcons} />
          {flip.kind === 'cross' && (
            <LegRow label="Sell" leg={flip.sell} item={item} hubIcons={hubIcons} />
          )}
        </div>
      </section>
    </Sheet>
  );
}

function ConvertStep({
  convert,
  hubIcons,
}: {
  convert: NonNullable<Flip['convert']>;
  hubIcons: Partial<Record<Hub, string>>;
}) {
  return (
    <li>
      Convert {HUB_NAMES[convert.from]} back to {HUB_NAMES[convert.to]}: 1{' '}
      <HubIcon hub={convert.from} hubIcons={hubIcons} /> → {formatQty(convert.avg)}{' '}
      <HubIcon hub={convert.to} hubIcons={hubIcons} />
    </li>
  );
}

function HubIcon({ hub, hubIcons }: { hub: Hub; hubIcons: Partial<Record<Hub, string>> }) {
  const src = hubIcons[hub];
  return src ? (
    <img src={src} alt={HUB_SHORT[hub]} width={16} height={16} className="inline h-4 w-4" />
  ) : (
    <span className="text-xs text-subtle">{HUB_SHORT[hub]}</span>
  );
}

function LegRow({
  label,
  leg,
  item,
  hubIcons,
}: {
  label: string;
  leg: FlipLeg;
  item: CurrentItem | undefined;
  hubIcons: Partial<Record<Hub, string>>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2 text-sm">
      <span className="font-medium">
        {label} · {item?.name ?? 'item'} ↔ {HUB_NAMES[leg.hub]}
      </span>
      <span className="flex items-center gap-1 text-muted">
        avg {formatQty(leg.avg)} <HubIcon hub={leg.hub} hubIcons={hubIcons} /> · range{' '}
        {formatQty(leg.low)}–{formatQty(leg.high)} · {leg.units24h.toLocaleString('en-US')} items /
        24 h
      </span>
    </div>
  );
}

/** Bar per hour of the window; filled bars reached `minMargin`. */
function HourlyMargins({
  hourly,
  hours,
  minMargin,
}: {
  hourly: readonly (number | null)[];
  hours: readonly number[];
  minMargin: number;
}) {
  const max = Math.max(minMargin / 100, ...hourly.map((m) => m ?? 0));
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Margin per hour</h3>
      <div className="flex h-24 items-end gap-0.5" role="list" aria-label="Margin per hour">
        {hourly.map((margin, i) => {
          const hour = hours[i];
          const label = hour === undefined ? '' : `${new Date(hour * 1000).getUTCHours()}:00 UTC`;
          const reached = margin !== null && margin * 100 >= minMargin;
          return (
            <div
              key={hour ?? i}
              role="listitem"
              title={`${label}: ${margin === null ? 'no trades' : formatMargin(margin)}`}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div
                className={`rounded-sm ${margin === null ? 'h-0.5 bg-line' : reached ? 'bg-gain' : 'bg-subtle'}`}
                style={
                  margin === null
                    ? undefined
                    : { height: `${Math.max(2, (Math.max(0, margin) / max) * 100)}%` }
                }
              />
            </div>
          );
        })}
      </div>
      <p className="mt-1 flex justify-between text-xs text-subtle">
        <span>{hours[0] === undefined ? '' : formatHour(hours[0])}</span>
        <span>green: ≥ {minMargin}% · grey: below · flat: no trades</span>
        <span>{hours.at(-1) === undefined ? '' : formatHour(hours.at(-1) ?? 0)}</span>
      </p>
    </section>
  );
}

function formatHour(epoch: number): string {
  return `${String(new Date(epoch * 1000).getUTCHours()).padStart(2, '0')}:00`;
}

function formatQty(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString('en-US');
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}
