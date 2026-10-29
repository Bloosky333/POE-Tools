import { relativeDay, type FarmSignal } from '@poe-tools/shared';
import { Amount, DataTable, ScoreMeter, Sparkline, type Column, Change } from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import type { SortKey, ViewParams } from './params.ts';
import { VerdictBadge } from './VerdictBadge.tsx';

interface Props {
  rows: readonly FarmSignal[];
  params: ViewParams;
  today: number;
  unit: UnitInfo;
  onSort: (key: SortKey) => void;
  onSelect: (mechanic: string) => void;
}

/** Key of a row in the URL: the mechanic, or 'any' for the baseline. */
export const mechanicKey = (s: FarmSignal) => s.mechanic ?? 'any';
export const mechanicLabel = (s: FarmSignal) => s.mechanic ?? 'Any content';

export function FarmTable({ rows, params, today, unit, onSort, onSelect }: Props) {
  const columns: Column<FarmSignal, SortKey>[] = [
    {
      id: 'mechanic',
      label: 'Mechanic',
      sortKey: 'mechanic',
      render: (s) => (
        <div className={s.mechanic ? 'font-medium' : 'text-subtle'}>
          {mechanicLabel(s)}
          {!s.mechanic && <div className="text-xs">drops anywhere · baseline</div>}
        </div>
      ),
    },
    {
      id: 'verdict',
      label: 'Verdict',
      render: (s) => <VerdictBadge signal={s} />,
    },
    {
      id: 'items',
      label: 'Top loot',
      sortKey: 'items',
      title: 'Most traded liquid items (and how many are counted)',
      render: (s) => (
        <div className="flex items-center gap-1">
          {s.items.slice(0, 3).map((f) => (
            <span
              key={f.item.id}
              title={f.item.name}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2"
            >
              {f.item.icon && <img src={f.item.icon} alt={f.item.name} className="h-6 w-6" />}
            </span>
          ))}
          <span className="ml-1 text-xs text-subtle">{s.items.length}</span>
        </div>
      ),
    },
    {
      id: 'value',
      label: 'Loot value',
      sortKey: 'value',
      align: 'right',
      title: 'Average price of a unit of its loot traded',
      className: 'font-medium',
      render: (s) => <Amount value={s.lootValue} unit={unit} />,
    },
    {
      id: 'size',
      label: 'Traded / day',
      sortKey: 'size',
      align: 'right',
      title: 'Value of its loot traded per day',
      className: 'text-muted',
      render: (s) => <Amount value={s.marketSize} unit={unit} />,
    },
    {
      id: 'index',
      label: 'Last 14 days',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end">
          <Sparkline points={s.index.current.filter((p) => p[0] >= today - 14)} />
        </div>
      ),
    },
    {
      id: 'trend',
      label: '7d vs mkt',
      sortKey: 'trend',
      align: 'right',
      title: 'Change of its loot over 7 days, relative to the market',
      render: (s) => <Change value={s.trend} ratio />,
    },
    {
      id: 'outlook',
      label: 'Last league',
      sortKey: 'outlook',
      align: 'right',
      title: 'How its loot moved last league over the next 14 days, relative to the market',
      render: (s) =>
        s.outlook === null ? (
          <span className="text-subtle">–</span>
        ) : (
          <span className="whitespace-nowrap">
            <Change value={s.outlook} ratio />
            <span className="text-xs text-subtle">
              {' '}
              {s.outlookDay !== null && relativeDay(s.outlookDay, today)}
            </span>
          </span>
        ),
    },
    {
      id: 'confidence',
      label: 'Confidence',
      sortKey: 'confidence',
      align: 'right',
      title: 'Confidence 0–100',
      render: (s) => (s.mechanic ? <ScoreMeter value={s.confidence} /> : null),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={mechanicKey}
      sort={{ key: params.sort, desc: params.desc }}
      onSort={onSort}
      onRowClick={(s) => onSelect(mechanicKey(s))}
      empty="No mechanic with these filters."
      minWidth="64rem"
    />
  );
}
