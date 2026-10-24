import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Suggestion } from '@poe-tools/shared';
import { formatMultiplier, formatPercent } from '../../lib/format.ts';
import { DataTable, Amount, ItemCell, ScoreMeter, Sparkline, type Column } from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import { ActionBadge } from './ActionBadge.tsx';
import type { SortKey, ViewParams } from './params.ts';

interface Props {
  rows: readonly Suggestion[];
  params: ViewParams;
  currentHistory: Record<string, HistoryPoint[]>;
  today: number;
  unit: UnitInfo;
  onSort: (key: SortKey) => void;
  onSelect: (itemId: string) => void;
}

export function SuggestionsTable({
  rows,
  params,
  currentHistory,
  today,
  unit,
  onSort,
  onSelect,
}: Props) {
  const columns: Column<Suggestion, SortKey>[] = [
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
      id: 'action',
      label: 'Suggestion',
      render: (s) => (
        <ActionBadge
          action={s.action}
          detail={s.action === 'wait' && s.reference ? `day ${s.reference.buyDay}` : undefined}
        />
      ),
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
      sortKey: 'change7d',
      align: 'right',
      title: 'Price trend; % over 7 days',
      render: (s) => {
        const change = s.item.change7d;
        return (
          <div className="flex items-center justify-end gap-2">
            <Sparkline
              points={(currentHistory[s.item.id] ?? []).filter((p) => p[0] >= today - 14)}
            />
            <span
              className={`w-11 text-right text-xs font-medium ${
                change === null ? 'text-subtle' : change >= 0 ? 'text-gain' : 'text-loss'
              }`}
            >
              {formatPercent(change)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'multiplier',
      label: 'Multiplier',
      sortKey: 'multiplier',
      align: 'right',
      title:
        'Expected price change from the buy day to the sell day: the reference-league change, reduced when the item is already pricier than last league',
      render: (s) => {
        const m = s.reference?.expectedMultiplier ?? null;
        const tone = m === null ? 'text-subtle' : m >= 1.3 ? 'text-gain' : m < 1 ? 'text-loss' : '';
        return <span className={`text-base font-semibold ${tone}`}>{formatMultiplier(m)}</span>;
      },
    },
    {
      id: 'sell',
      label: 'Sell',
      sortKey: 'sellDay',
      align: 'right',
      title: 'Suggested sell day (league day)',
      className: 'text-muted',
      render: (s) => (s.reference ? `day ${s.reference.sellDay}` : '–'),
    },
    {
      id: 'projected',
      label: 'Projected',
      align: 'right',
      title: 'Current price × expected multiplier',
      render: (s) => <Amount value={s.projectedSellPrice} unit={unit} />,
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
      empty="No item matches these filters."
    />
  );
}
