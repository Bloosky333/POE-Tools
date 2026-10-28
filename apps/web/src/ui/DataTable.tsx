import type { ReactNode } from 'react';

export interface Column<Row, Key extends string> {
  /** Unique column id. */
  id: string;
  label: string;
  /** Sort key; omit for non-sortable columns. */
  sortKey?: Key;
  align?: 'left' | 'right';
  title?: string;
  className?: string;
  render: (row: Row) => ReactNode;
}

export interface SortState<Key extends string> {
  key: Key;
  desc: boolean;
}

/**
 * Sortable, clickable data table with the app's table styling (row hover, keyboard
 * focus: Enter or Space opens a row). Sorting itself is done by the caller.
 */
export function DataTable<Row, Key extends string>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  onRowClick,
  empty = 'Nothing to show.',
  minWidth = '64rem',
}: {
  columns: readonly Column<Row, Key>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  sort?: SortState<Key>;
  onSort?: (key: Key) => void;
  onRowClick?: (row: Row) => void;
  empty?: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="border-b border-line bg-surface-2 text-left text-xs text-muted">
          <tr>
            {columns.map((col) => {
              const active = col.sortKey !== undefined && sort?.key === col.sortKey;
              return (
                <th
                  key={col.id}
                  scope="col"
                  title={col.title}
                  aria-sort={active ? (sort?.desc ? 'descending' : 'ascending') : undefined}
                  className={`px-3 py-2.5 font-medium whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.sortKey !== undefined && onSort ? (
                    <button
                      type="button"
                      className={`hover:text-fg ${active ? 'text-fg' : ''}`}
                      onClick={() => onSort(col.sortKey as Key)}
                    >
                      {col.label}
                      <span className="ml-0.5 inline-block w-2 text-accent">
                        {active ? (sort?.desc ? '↓' : '↑') : ''}
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
            <tr
              key={rowKey(row)}
              className={
                onRowClick
                  ? 'cursor-pointer outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:shadow-[inset_2px_0_0_var(--c-accent)]'
                  : ''
              }
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick && (() => onRowClick(row))}
              onKeyDown={
                onRowClick &&
                ((e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  onRowClick(row);
                })
              }
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.className ?? ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
