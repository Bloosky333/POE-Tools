import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type SellSignal } from '@poe-tools/shared';
import { formatPercent } from '../../lib/format.ts';
import {
  DataTable,
  Amount,
  ItemCell,
  ScoreMeter,
  Sparkline,
  type Column,
  Change,
} from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import type { SortKey, ViewParams } from './params.ts';
import { VerdictBadge } from './VerdictBadge.tsx';

interface Props {
  rows: readonly SellSignal[];
  params: ViewParams;
  currentHistory: Record<string, HistoryPoint[]>;
  today: number;
  unit: UnitInfo;
  onSort: (key: SortKey) => void;
  onSelect: (itemId: string) => void;
}

export function SellTable({ rows, params, currentHistory, today, unit, onSort, onSelect }: Props) {
  const columns: Column<SellSignal, SortKey>[] = [
    {
      id: 'item',
      label: 'Item',
      sortKey: 'name',
      render: (s) => (
        <ItemCell
          icon={s.item.icon}
          name={s.item.name}
          subtitle={EXCHANGE_TYPE_LABELS[s.item.type]}
        />
      ),
    },
    {
      id: 'verdict',
      label: 'Verdict',
      sortKey: 'sellDay',
      title: 'Sell now, or sell soon around the given league day',
      render: (s) => <VerdictBadge signal={s} />,
    },
    {
      id: 'price',
      label: 'Price',
      sortKey: 'price',
      align: 'right',
      title: 'Current price',
      className: 'font-medium',
      render: (s) => <Amount value={s.item.price} unit={unit} />,
    },
    {
      id: 'trend',
      label: 'Last 14 days',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end">
          <Sparkline points={(currentHistory[s.item.id] ?? []).filter((p) => p[0] >= today - 14)} />
        </div>
      ),
    },
    {
      id: 'change1d',
      label: '1d',
      sortKey: 'change1d',
      align: 'right',
      title: 'Price change over 1 day',
      render: (s) => <Change value={s.change[1]} />,
    },
    {
      id: 'change3d',
      label: '3d',
      sortKey: 'change3d',
      align: 'right',
      title: 'Price change over 3 days',
      render: (s) => <Change value={s.change[3]} />,
    },
    {
      id: 'change7d',
      label: '7d',
      sortKey: 'change7d',
      align: 'right',
      title: 'Price change over 7 days',
      render: (s) => <Change value={s.change[7]} />,
    },
    {
      id: 'fromHigh',
      label: 'vs high',
      sortKey: 'fromHigh',
      align: 'right',
      title: "Current price vs this league's highest price so far",
      className: 'text-muted',
      render: (s) => formatPercent(s.fromHigh === null ? null : (s.fromHigh - 1) * 100),
    },
    {
      id: 'reference',
      label: 'Last league',
      align: 'right',
      title: 'How the price moved last league after the peak (or after today)',
      render: (s) =>
        s.reference ? (
          <span className="whitespace-nowrap">
            <Change value={s.reference.change - 1} />
            <span className="text-xs text-subtle"> by day {s.reference.horizonDay}</span>
          </span>
        ) : (
          <span className="text-subtle">–</span>
        ),
    },
    {
      id: 'loss',
      label: 'Exp. loss',
      sortKey: 'loss',
      align: 'right',
      title: 'Expected loss if held, from last league',
      render: (s) => (
        <span
          className={`text-base font-semibold ${s.expectedLoss > 0 ? 'text-loss' : 'text-subtle'}`}
        >
          {s.expectedLoss > 0 ? formatPercent(-s.expectedLoss * 100) : '–'}
        </span>
      ),
    },
    {
      id: 'confidence',
      label: 'Confidence',
      sortKey: 'confidence',
      align: 'right',
      title: 'Confidence 0–100',
      render: (s) => <ScoreMeter value={s.confidence} />,
    },
    {
      id: 'volume',
      label: 'Volume',
      sortKey: 'volume',
      align: 'right',
      title: 'Traded per day',
      className: 'text-muted',
      render: (s) => <Amount value={s.item.volume} unit={unit} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(s) => s.item.id}
      sort={{ key: params.sort, desc: params.desc }}
      onSort={onSort}
      onRowClick={(s) => onSelect(s.item.id)}
      empty="Nothing to sell with these filters."
      minWidth="72rem"
    />
  );
}
