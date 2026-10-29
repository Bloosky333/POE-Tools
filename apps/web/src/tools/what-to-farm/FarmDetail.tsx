import { relativeDay, type FarmSignal } from '@poe-tools/shared';
import { Link } from 'react-router';
import { formatPercent } from '../../lib/format.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import {
  Amount,
  DataTable,
  ItemCell,
  PriceChart,
  RatioBar,
  Sheet,
  StatCard,
  type Column,
  type Tone,
  Change,
} from '../../ui/index.ts';
import { mechanicLabel } from './FarmTable.tsx';
import { VerdictBadge } from './VerdictBadge.tsx';

interface Props {
  signal: FarmSignal;
  referenceName: string;
  currentName: string;
  today: number;
  unit: UnitInfo;
  onClose: () => void;
}

const pct = (ratio: number | null) => formatPercent(ratio === null ? null : (ratio - 1) * 100);
const tone = (ratio: number | null): Tone =>
  ratio === null ? 'default' : ratio >= 1 ? 'gain' : 'loss';

/** Index values are ratios to today: the chart shows them without a currency. */
const INDEX_UNIT = { id: 'index', short: '× today' };

type Row = FarmSignal['items'][number];

export function FarmDetail(props: Props) {
  const { signal: s, unit } = props;
  const columns: Column<Row, never>[] = [
    {
      id: 'item',
      label: 'Item',
      render: (f) => <ItemCell icon={f.item.icon} name={f.item.name} size="sm" />,
    },
    {
      id: 'share',
      label: 'Weight',
      align: 'right',
      title: 'Share of the mechanic index (by volume, capped)',
      className: 'text-muted',
      render: (f) => `${Math.round(f.share * 100)} %`,
    },
    {
      id: 'price',
      label: 'Price',
      align: 'right',
      render: (f) => <Amount value={f.item.price} unit={unit} />,
    },
    {
      id: 'trend',
      label: '7d vs mkt',
      align: 'right',
      render: (f) => <Change value={f.trend} ratio />,
    },
    {
      id: 'outlook',
      label: 'Last league',
      align: 'right',
      render: (f) => <Change value={f.outlook} ratio />,
    },
    {
      id: 'links',
      label: '',
      align: 'right',
      render: (f) => (
        <span className="space-x-2 text-xs whitespace-nowrap">
          <Link
            to={`/tools/currency-speculation?item=${encodeURIComponent(f.item.id)}`}
            className="text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Speculation
          </Link>
          <Link
            to={`/tools/sell-now?verdict=all&item=${encodeURIComponent(f.item.id)}`}
            className="text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Sell Now
          </Link>
        </span>
      ),
    },
  ];

  return (
    <Sheet
      label={`${mechanicLabel(s)} details`}
      onClose={props.onClose}
      header={
        <>
          <h2 className="text-lg font-semibold">{mechanicLabel(s)}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {s.items.length} items ·
            <Amount value={s.marketSize} unit={unit} className="text-fg" /> traded per day
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

      <section>
        <h3 className="mb-2 text-sm font-medium">Loot index (1 = today)</h3>
        <PriceChart
          reference={s.index.reference}
          current={s.index.current}
          referenceLabel={props.referenceName}
          currentLabel={props.currentName}
          today={props.today}
          unit={INDEX_UNIT}
          windowFrom={s.outlookDay === null ? undefined : props.today}
          windowTo={s.outlookDay ?? undefined}
        />
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Loot value">
          <Amount value={s.lootValue} unit={unit} />
        </StatCard>
        <StatCard label="7 days vs market" tone={tone(s.trend)}>
          {pct(s.trend)}
        </StatCard>
        <StatCard
          label={
            s.outlookDay === null
              ? 'Last league'
              : `Last league · ${relativeDay(s.outlookDay, props.today)}`
          }
          tone={tone(s.outlook)}
        >
          {pct(s.outlook)}
        </StatCard>
        {s.mechanic && <StatCard label="Confidence">{s.confidence} / 100</StatCard>}
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-medium">Loot</h3>
        <DataTable columns={columns} rows={s.items} rowKey={(f) => f.item.id} minWidth="36rem" />
        <p className="mt-2 text-xs text-subtle">
          Items are assigned to mechanics by a hand-kept list; some may be misassigned.
        </p>
      </section>

      {s.mechanic && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Confidence breakdown</h3>
          <div className="space-y-2">
            <RatioBar label="Follows the reference recently" value={s.breakdown.similarity} />
            <RatioBar label="Liquidity" value={s.breakdown.liquidity} />
            <RatioBar label="Loot with reference data" value={s.breakdown.completeness} />
          </div>
        </section>
      )}
    </Sheet>
  );
}
