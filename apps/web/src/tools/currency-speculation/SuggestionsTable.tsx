import type { Suggestion } from '@poe-tools/shared';
import { EXCHANGE_TYPE_LABELS } from '@poe-tools/shared';
import { formatDiv, formatMultiplier, formatPercent } from '../../lib/format.ts';
import { ActionBadge } from './ActionBadge.tsx';
import type { SortKey, ViewParams } from './params.ts';

interface Props {
  rows: readonly Suggestion[];
  params: ViewParams;
  onSort: (key: SortKey) => void;
  onSelect: (itemId: string) => void;
}

const COLUMNS: { key: SortKey | null; label: string; align?: 'right'; title?: string }[] = [
  { key: 'name', label: 'Item' },
  { key: null, label: 'Action' },
  { key: 'price', label: 'Now', align: 'right', title: 'Current price (div)' },
  {
    key: 'multiplier',
    label: 'Multiplier',
    align: 'right',
    title: 'Reference-league price change from the buy day to the sell day',
  },
  { key: null, label: 'Buy', align: 'right', title: 'Suggested buy day (league day)' },
  { key: 'sellDay', label: 'Sell', align: 'right', title: 'Suggested sell day (league day)' },
  { key: null, label: 'Projected', align: 'right', title: 'Now × multiplier (div)' },
  { key: 'confidence', label: 'Conf.', align: 'right', title: 'Confidence 0–100' },
  { key: 'volume', label: 'Volume', align: 'right', title: 'Traded per day (div)' },
  { key: 'change7d', label: '7d', align: 'right', title: 'Price change over 7 days' },
];

export function SuggestionsTable({ rows, params, onSort, onSelect }: Props) {
  return (
    <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[56rem] text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key !== null && params.sort === col.key;
              return (
                <th
                  key={col.label}
                  scope="col"
                  title={col.title}
                  aria-sort={active ? (params.desc ? 'descending' : 'ascending') : undefined}
                  className={`px-3 py-2 font-medium ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.key ? (
                    <button
                      type="button"
                      className="hover:text-gray-900 dark:hover:text-gray-100"
                      onClick={() => onSort(col.key as SortKey)}
                    >
                      {col.label}
                      {active && (params.desc ? ' ↓' : ' ↑')}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ref = row.reference;
            const waiting = row.action === 'wait';
            return (
              <tr
                key={row.item.id}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                onClick={() => onSelect(row.item.id)}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {row.item.icon && (
                      <img
                        src={row.item.icon}
                        alt=""
                        width={24}
                        height={24}
                        loading="lazy"
                        className="h-6 w-6"
                      />
                    )}
                    <div>
                      <div className="font-medium">{row.item.name}</div>
                      <div className="text-xs text-gray-500">
                        {EXCHANGE_TYPE_LABELS[row.item.type]}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <ActionBadge action={row.action} />
                </td>
                <td className="px-3 py-1.5 text-right">{formatDiv(row.item.price)}</td>
                <td className="px-3 py-1.5 text-right font-medium">
                  {formatMultiplier(
                    ref ? (waiting ? ref.multiplierFromBuy : ref.multiplier) : null,
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {ref ? (waiting ? `day ${ref.buyDay}` : 'now') : '–'}
                </td>
                <td className="px-3 py-1.5 text-right">{ref ? `day ${ref.sellDay}` : '–'}</td>
                <td className="px-3 py-1.5 text-right">{formatDiv(row.projectedSellPrice)}</td>
                <td className="px-3 py-1.5 text-right">{row.confidence}</td>
                <td className="px-3 py-1.5 text-right">{formatDiv(row.item.volume)}</td>
                <td className="px-3 py-1.5 text-right">{formatPercent(row.item.change7d)}</td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-gray-500">
                No item matches these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
