import { EXCHANGE_TYPE_LABELS, POE2_EXCHANGE_TYPES, type Suggestion } from '@poe-tools/shared';
import { useMemo, type ReactNode } from 'react';
import { Div } from '../../components/Div.tsx';
import { SearchIcon } from '../../components/icons.tsx';
import { formatMultiplier } from '../../lib/format.ts';
import { ACTION_LABELS } from './ActionBadge.tsx';
import { ItemDetail } from './ItemDetail.tsx';
import { MODES, useViewParams, type SortKey, type ViewParams } from './params.ts';
import { SuggestionsTable } from './SuggestionsTable.tsx';
import { useSuggestions } from './useSuggestions.ts';

export default function CurrencySpeculationPage() {
  const [params, update] = useViewParams();
  const mode = MODES.find((m) => m.value === params.mode)?.mode ?? { kind: 'horizon', days: 14 };
  const { league, reference, today, data, suggestions, divineIcon } = useSuggestions(
    mode,
    params.minVolume,
  );

  const eligible = useMemo(
    () => filterAndSort(suggestions, { ...params, type: 'all', action: 'all', q: '' }),
    [suggestions, params],
  );
  const rows = useMemo(() => filterAndSort(suggestions, params), [suggestions, params]);
  const selected = params.item ? suggestions.find((s) => s.item.id === params.item) : undefined;

  if (!league || !reference) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Currency Speculation</h1>
          <p className="mt-1 text-sm text-muted">
            What to buy now and sell later, from how prices moved in{' '}
            <span className="text-fg">{reference.name}</span> at the same point of the league.
          </p>
        </div>
        <div className="flex max-w-full min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs text-muted">Sell after</span>
          <ModeToggle value={params.mode} onChange={(value) => update({ mode: value })} />
        </div>
      </header>

      {data.status === 'loading' && <SkeletonRows />}
      {data.status === 'error' && (
        <p className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          ⚠ Price data couldn't be loaded ({data.error.message}). The data job may not have run yet.
        </p>
      )}
      {data.status === 'ready' && (
        <>
          <StatTiles
            suggestions={eligible}
            today={today}
            leagueName={league.name}
            divineIcon={divineIcon}
          />

          <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
            <CategoryChips
              suggestions={eligible}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <Filters params={params} update={update} />
          </div>

          <SuggestionsTable
            rows={rows}
            params={params}
            currentHistory={data.data.currentHistory}
            today={today}
            divineIcon={divineIcon}
            onSort={(key: SortKey) =>
              update(
                params.sort === key ? { desc: !params.desc } : { sort: key, desc: key !== 'name' },
              )
            }
            onSelect={(item) => update({ item })}
          />
          <p className="text-xs text-subtle">
            {rows.length} of {suggestions.length} items · history prices are daily averages paid
            across divine, exalted and chaos pairs.
          </p>
          {selected && (
            <ItemDetail
              suggestion={selected}
              reference={data.data.referenceHistory[selected.item.id] ?? []}
              current={data.data.currentHistory[selected.item.id] ?? []}
              referenceName={reference.name}
              currentName={league.name}
              today={today}
              divineIcon={divineIcon}
              onClose={() => update({ item: null })}
            />
          )}
        </>
      )}
    </section>
  );
}

function ModeToggle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Sell strategy"
      className="flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            value === m.value ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'
          }`}
        >
          {m.short}
        </button>
      ))}
    </div>
  );
}

function StatTiles({
  suggestions,
  today,
  leagueName,
  divineIcon,
}: {
  suggestions: readonly Suggestion[];
  today: number;
  leagueName: string;
  divineIcon: string | undefined;
}) {
  const count = (action: Suggestion['action']) =>
    suggestions.filter((s) => s.action === action).length;
  const best = [...suggestions]
    .filter((s) => s.action === 'buy' || s.action === 'wait')
    .sort((a, b) => b.score - a.score)[0];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tile label={leagueName} value={`Day ${today}`} />
      <Tile label="Buy now" value={count('buy')} tone="text-gain" />
      <Tile label="Wait for a dip" value={count('wait')} tone="text-warn" />
      <Tile label="Avoid" value={count('avoid')} tone="text-loss" />
      <Tile
        label="Top opportunity"
        value={best ? formatMultiplier(best.reference?.multiplierFromBuy) : '–'}
        tone="text-accent"
        detail={
          best ? (
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">{best.item.name}</span>
              <span aria-hidden>·</span>
              <Div value={best.item.price} icon={divineIcon} className="shrink-0" />
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  tone = '',
  detail,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
      {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
    </div>
  );
}

function CategoryChips({
  suggestions,
  value,
  onChange,
}: {
  suggestions: readonly Suggestion[];
  value: ViewParams['type'];
  onChange: (value: ViewParams['type']) => void;
}) {
  const counts = new Map<string, number>();
  for (const s of suggestions) counts.set(s.item.type, (counts.get(s.item.type) ?? 0) + 1);
  const chip = (key: ViewParams['type'], label: string, count: number) => (
    <button
      key={key}
      type="button"
      aria-pressed={value === key}
      onClick={() => onChange(key)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        value === key
          ? 'border-accent bg-accent-soft text-fg'
          : 'border-line text-muted hover:border-subtle hover:text-fg'
      }`}
    >
      {label}
      <span className="text-subtle">{count}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chip('all', 'All', suggestions.length)}
      {POE2_EXCHANGE_TYPES.filter((t) => counts.get(t)).map((t) =>
        chip(t, EXCHANGE_TYPE_LABELS[t], counts.get(t) ?? 0),
      )}
    </div>
  );
}

const inputClass =
  'h-8 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg outline-none hover:border-subtle focus-visible:border-accent';

function Filters({
  params,
  update,
}: {
  params: ViewParams;
  update: (p: Partial<ViewParams>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <label className="relative w-full sm:w-auto">
        <span className="sr-only">Search</span>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-subtle"
          width={15}
          height={15}
        />
        <input
          type="search"
          placeholder="Search items"
          className={`${inputClass} w-full pl-7 sm:w-56`}
          value={params.q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </label>
      <Inline label="Suggestion">
        <select
          className={inputClass}
          value={params.action}
          onChange={(e) => update({ action: e.target.value as ViewParams['action'] })}
        >
          <option value="all">All</option>
          {(['buy', 'wait', 'avoid', 'neutral'] as const).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </Inline>
      <Inline label="Min volume">
        <input
          type="number"
          min={0}
          step={1}
          className={`${inputClass} w-20`}
          value={params.minVolume}
          onChange={(e) => update({ minVolume: Number(e.target.value) || 0 })}
        />
        <span className="text-xs text-subtle">div/day</span>
      </Inline>
      <Inline label="Min price">
        <input
          type="number"
          min={0}
          step={0.01}
          className={`${inputClass} w-20`}
          value={params.minPrice}
          onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
        />
        <span className="text-xs text-subtle">div</span>
      </Inline>
    </div>
  );
}

function Inline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-label="Loading price data">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}

export function filterAndSort(
  suggestions: readonly Suggestion[],
  params: ViewParams,
): Suggestion[] {
  const q = params.q.trim().toLowerCase();
  const rows = suggestions.filter(
    (s) =>
      s.item.volume >= params.minVolume &&
      s.item.price >= params.minPrice &&
      (params.type === 'all' || s.item.type === params.type) &&
      (params.action === 'all' || s.action === params.action) &&
      (!q || s.item.name.toLowerCase().includes(q)),
  );
  const value = (s: Suggestion): number | string => {
    switch (params.sort) {
      case 'name':
        return s.item.name;
      case 'price':
        return s.item.price;
      case 'multiplier':
        return s.reference?.multiplierFromBuy ?? -Infinity;
      case 'confidence':
        return s.confidence;
      case 'volume':
        return s.item.volume;
      case 'change7d':
        return s.item.change7d ?? -Infinity;
      case 'sellDay':
        return s.reference?.sellDay ?? Infinity;
      default:
        return s.score;
    }
  };
  return rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number);
    return params.desc ? -cmp : cmp;
  });
}
