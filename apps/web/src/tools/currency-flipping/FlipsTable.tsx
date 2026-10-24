import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Hub } from '@poe-tools/shared';
import { DataTable, Div, ItemCell, ScoreMeter, Sparkline, type Column } from '../../ui/index.ts';
import type { FlipRow, SortKey, ViewParams } from './logic.ts';
import { KindBadge, OrderRatio, formatMargin, quotePrices } from './parts.tsx';

interface Props {
  rows: readonly FlipRow[];
  params: ViewParams;
  hubIcons: Partial<Record<Hub, string>>;
  onSort: (key: SortKey) => void;
  onSelect: (flipId: string) => void;
}

export function FlipsTable({ rows, params, hubIcons, onSort, onSelect }: Props) {
  const columns: Column<FlipRow, SortKey>[] = [
    {
      id: 'item',
      label: 'Item',
      sortKey: 'name',
      render: ({ flip, item }) => (
        <ItemCell
          icon={item?.icon}
          name={item?.name ?? flip.item}
          subtitle={item ? EXCHANGE_TYPE_LABELS[item.type] : undefined}
        />
      ),
    },
    {
      id: 'kind',
      label: 'Type',
      render: ({ flip }) => <KindBadge flip={flip} />,
    },
    {
      id: 'buy',
      label: 'Buy',
      title: 'Order to place: pay → get',
      render: ({ flip, item }) => (
        <OrderRatio
          side="buy"
          price={quotePrices(flip).buy}
          hub={flip.buy.hub}
          item={item}
          hubIcons={hubIcons}
        />
      ),
    },
    {
      id: 'sell',
      label: 'Sell',
      title: 'Order to place: pay → get',
      render: ({ flip, item }) => (
        <OrderRatio
          side="sell"
          price={quotePrices(flip).sell}
          hub={flip.sell.hub}
          item={item}
          hubIcons={hubIcons}
        />
      ),
    },
    {
      id: 'margin',
      label: 'Margin',
      sortKey: 'margin',
      align: 'right',
      title: 'Margin in the newest hour: average prices (cross-pair) or hour range (spread)',
      render: ({ flip }) => (
        <span className="text-base font-semibold text-gain">{formatMargin(flip.margin)}</span>
      ),
    },
    {
      id: 'hours',
      label: 'Last 24 h',
      align: 'right',
      title: 'Margin per hour',
      render: ({ flip }) => (
        <div className="flex justify-end">
          <Sparkline points={hourlyPoints(flip.hourly)} />
        </div>
      ),
    },
    {
      id: 'recurrence',
      label: 'Recurrence',
      sortKey: 'recurrence',
      align: 'right',
      title: `Share of hours with at least ${params.minMargin}% margin`,
      render: ({ recurrence }) => <ScoreMeter value={recurrence} />,
    },
    {
      id: 'units',
      label: 'Volume',
      sortKey: 'units',
      align: 'right',
      title: 'Items traded over 24 h on the thinnest leg',
      render: ({ flip }) => flip.units24h.toLocaleString('en-US'),
    },
    {
      id: 'value',
      label: 'Value',
      sortKey: 'value',
      align: 'right',
      title: 'Divine traded over 24 h on the thinnest leg',
      className: 'text-muted',
      render: ({ flip }) => <Div value={flip.value24h} icon={hubIcons.divine} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.flip.id}
      sort={{ key: params.sort, desc: params.desc }}
      onSort={onSort}
      onRowClick={(r) => onSelect(r.flip.id)}
      empty="No flip matches these filters."
    />
  );
}

/** Hourly margins as sparkline points (hours without a margin are skipped). */
function hourlyPoints(hourly: readonly (number | null)[]): HistoryPoint[] {
  return hourly.flatMap((margin, i): HistoryPoint[] => (margin === null ? [] : [[i, margin, 0]]));
}
