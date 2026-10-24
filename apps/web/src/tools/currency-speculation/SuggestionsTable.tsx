import { EXCHANGE_TYPE_LABELS, type HistoryPoint, type Suggestion } from '@poe-tools/shared';
import { Div } from '../../components/Div.tsx';
import { formatMultiplier, formatPercent } from '../../lib/format.ts';
import { ActionBadge } from './ActionBadge.tsx';
import type { SortKey, ViewParams } from './params.ts';
import { Sparkline } from './Sparkline.tsx';

interface Props {
  rows: readonly Suggestion[];
  params: ViewParams;
  currentHistory: Record<string, HistoryPoint[]>;
  today: number;
  divineIcon: string | undefined;
  onSort: (key: SortKey) => void;
  onSelect: (itemId: string) => void;
}

const COLUMNS: { key: SortKey | null; label: string; align?: 'right'; title?: string }[] = [
  { key: 'name', label: 'Item' },
  { key: null, label: 'Suggestion' },
  { key: 'price', label: 'Price', align: 'right', title: 'Current price' },
  { key: 'change7d', label: 'Last 14 days', align: 'right', title: 'Price trend; % over 7 days' },
  {
    key: 'multiplier',
    label: 'Multiplier',
    align: 'right',
    title: 'Reference-league price change from the buy day to the sell day',
  },
  { key: 'sellDay', label: 'Sell', align: 'right', title: 'Suggested sell day (league day)' },
  { key: null, label: 'Projected', align: 'right', title: 'Current price × multiplier' },
  { key: 'confidence', label: 'Confidence', align: 'right', title: 'Confidence 0–100' },
  { key: 'volume', label: 'Volume', align: 'right', title: 'Traded per day' },
];

export function SuggestionsTable(props: Props) {
  const { rows, params, onSort, onSelect } = props;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[64rem] text-sm">
        <thead className="sticky top-0 border-b border-line bg-surface-2 text-left text-xs text-muted">
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key !== null && params.sort === col.key;
              return (
                <th
                  key={col.label}
                  scope="col"
                  title={col.title}
                  aria-sort={active ? (params.desc ? 'descending' : 'ascending') : undefined}
                  className={`px-3 py-2.5 font-medium whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.key ? (
                    <button
                      type="button"
                      className={`hover:text-fg ${active ? 'text-fg' : ''}`}
                      onClick={() => onSort(col.key as SortKey)}
                    >
                      {col.label}
                      <span className="ml-0.5 inline-block w-2 text-accent">
                        {active ? (params.desc ? '↓' : '↑') : ''}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <Row key={row.item.id} row={row} {...props} onSelect={onSelect} />
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-muted">
                No item matches these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, currentHistory, today, divineIcon, onSelect }: Props & { row: Suggestion }) {
  const ref = row.reference;
  const waiting = row.action === 'wait';
  const multiplier = ref ? (waiting ? ref.multiplierFromBuy : ref.multiplier) : null;
  const trend = (currentHistory[row.item.id] ?? []).filter((p) => p[0] >= today - 14);
  const change = row.item.change7d;

  return (
    <tr
      className="cursor-pointer outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:shadow-[inset_2px_0_0_var(--c-accent)]"
      onClick={() => onSelect(row.item.id)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(row.item.id)}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2">
            {row.item.icon && (
              <img
                src={row.item.icon}
                alt=""
                width={30}
                height={30}
                loading="lazy"
                className="h-7.5 w-7.5"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{row.item.name}</div>
            <div className="text-xs text-subtle">{EXCHANGE_TYPE_LABELS[row.item.type]}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <ActionBadge
          action={row.action}
          detail={waiting && ref ? `day ${ref.buyDay}` : undefined}
        />
      </td>
      <td className="px-3 py-2 text-right font-medium">
        <Div value={row.item.price} icon={divineIcon} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <Sparkline points={trend} />
          <span
            className={`w-11 text-right text-xs font-medium ${
              change === null ? 'text-subtle' : change >= 0 ? 'text-gain' : 'text-loss'
            }`}
          >
            {formatPercent(change)}
          </span>
        </div>
      </td>
      <td
        className={`px-3 py-2 text-right text-base font-semibold ${
          multiplier === null
            ? 'text-subtle'
            : multiplier >= 1.3
              ? 'text-gain'
              : multiplier < 1
                ? 'text-loss'
                : ''
        }`}
      >
        {formatMultiplier(multiplier)}
      </td>
      <td className="px-3 py-2 text-right text-muted">{ref ? `day ${ref.sellDay}` : '–'}</td>
      <td className="px-3 py-2 text-right">
        <Div value={row.projectedSellPrice} icon={divineIcon} />
      </td>
      <td className="px-3 py-2">
        <ConfidenceMeter value={row.confidence} />
      </td>
      <td className="px-3 py-2 text-right text-muted">
        <Div value={row.item.volume} icon={divineIcon} />
      </td>
    </tr>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= 70 ? 'bg-gain' : value >= 40 ? 'bg-warn' : 'bg-loss';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-muted">{value}</span>
    </div>
  );
}
