import { linkedItems, type CraftAction, type CurrentItem } from '@poe-tools/shared';
import { useState } from 'react';
import { Amount, Button, Chips, NumericInput, SearchInput } from '../../ui/index.ts';
import { useCatalog } from './catalog.ts';
import { ItemName } from './parts.tsx';

/**
 * Items used together in one action (C9): picked by category, then item, with the
 * curated companions of the items already chosen (omens of a currency…) one click away.
 */
export function ActionEditor({
  action,
  onChange,
  label = 'Items',
  optional = false,
}: {
  action: CraftAction;
  onChange: (action: CraftAction) => void;
  label?: string;
  /** Optional action (a gate's recovery): the picker starts closed. */
  optional?: boolean;
}) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(action.length === 0 && !optional);
  const chosen = new Set(action.map((u) => u.itemId));
  const linked = [...new Set(action.flatMap((u) => linkedItems(catalog.game, u.itemId)))].filter(
    (id) => !chosen.has(id) && catalog.items.has(id),
  );
  const add = (itemId: string) => {
    if (!chosen.has(itemId)) onChange([...action, { itemId, count: 1 }]);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {action.map((use, i) => (
          <span
            key={use.itemId}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 py-0.5 pr-1 pl-2 text-sm"
          >
            <ItemName itemId={use.itemId} />
            <NumericInput
              min={1}
              integer
              aria-label="Count"
              className="h-6 w-14 px-1"
              value={use.count}
              onChange={(count) => onChange(action.map((u, j) => (j === i ? { ...u, count } : u)))}
            />
            <button
              type="button"
              aria-label={`Remove ${catalog.items.get(use.itemId)?.name ?? 'item'}`}
              className="rounded px-1 text-subtle hover:text-loss"
              onClick={() => onChange(action.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <Button variant="ghost" onClick={() => setOpen(!open)}>
          {open ? 'Close picker' : '+ Add item'}
        </Button>
      </div>
      {linked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Linked:</span>
          {linked.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => add(id)}
              className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 hover:border-accent"
            >
              + <ItemName itemId={id} />
            </button>
          ))}
        </div>
      )}
      {open && (
        <ItemPicker
          onPick={(id) => {
            add(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ItemPicker({ onPick }: { onPick: (itemId: string) => void }) {
  const { categories, unit } = useCatalog();
  const [type, setType] = useState(categories[0]?.type ?? '');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const pool: CurrentItem[] = query
    ? categories.flatMap((c) => c.items)
    : (categories.find((c) => c.type === type)?.items ?? []);
  const shown = pool.filter((i) => !query || i.name.toLowerCase().includes(query)).slice(0, 60);

  return (
    <div className="space-y-2 rounded-lg border border-line p-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search all crafting items" value={q} onChange={setQ} />
      </div>
      {!query && (
        <Chips
          options={categories.map((c) => ({
            value: c.type,
            label: c.label,
            count: c.items.length,
          }))}
          value={type}
          onChange={setType}
        />
      )}
      <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2"
            >
              <ItemName itemId={item.id} />
              <Amount value={item.price} unit={unit} className="shrink-0 text-xs text-muted" />
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-1 text-sm text-subtle">No item.</li>}
      </ul>
    </div>
  );
}
