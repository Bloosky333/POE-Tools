import { EXCHANGE_TYPE_LABELS, POE2_EXCHANGE_TYPES, type Suggestion } from '@poe-tools/shared';
import { useMemo } from 'react';
import { formatMultiplier } from '../../lib/format.ts';
import {
  Card,
  Chips,
  Div,
  FilterBar,
  InlineField,
  Input,
  Notice,
  PageHeader,
  SearchInput,
  Segmented,
  Select,
  Skeleton,
  StatTile,
} from '../../ui/index.ts';
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
      <PageHeader
        title="Currency Speculation"
        description={
          <>
            What to buy now and sell later, from how prices moved in{' '}
            <span className="text-fg">{reference.name}</span> at the same point of the league.
          </>
        }
        actions={
          <>
            <span className="shrink-0 text-xs text-muted">Sell after</span>
            <Segmented
              label="Sell strategy"
              options={MODES.map((m) => ({ value: m.value, label: m.short }))}
              value={params.mode}
              onChange={(mode) => update({ mode })}
            />
          </>
        }
      />

      {data.status === 'loading' && <Skeleton label="Loading price data" />}
      {data.status === 'error' && (
        <Notice>
          Price data couldn&apos;t be loaded ({data.error.message}). The data job may not have run
          yet.
        </Notice>
      )}
      {data.status === 'ready' && (
        <>
          <StatTiles
            suggestions={eligible}
            today={today}
            leagueName={league.name}
            divineIcon={divineIcon}
          />

          <Card className="space-y-3">
            <CategoryChips
              suggestions={eligible}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <Filters params={params} update={update} />
          </Card>

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
      <StatTile label={leagueName} value={`Day ${today}`} />
      <StatTile label="Buy now" value={count('buy')} tone="gain" />
      <StatTile label="Wait for a dip" value={count('wait')} tone="warn" />
      <StatTile label="Avoid" value={count('avoid')} tone="loss" />
      <StatTile
        label="Top opportunity"
        value={best ? formatMultiplier(best.reference?.multiplierFromBuy) : '–'}
        tone="accent"
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
  return (
    <Chips<ViewParams['type']>
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', count: suggestions.length },
        ...POE2_EXCHANGE_TYPES.filter((t) => counts.get(t)).map((t) => ({
          value: t,
          label: EXCHANGE_TYPE_LABELS[t],
          count: counts.get(t) ?? 0,
        })),
      ]}
    />
  );
}

function Filters({
  params,
  update,
}: {
  params: ViewParams;
  update: (p: Partial<ViewParams>) => void;
}) {
  return (
    <FilterBar>
      <SearchInput placeholder="Search items" value={params.q} onChange={(q) => update({ q })} />
      <InlineField label="Suggestion">
        <Select
          value={params.action}
          onChange={(e) => update({ action: e.target.value as ViewParams['action'] })}
        >
          <option value="all">All</option>
          {(['buy', 'wait', 'avoid', 'neutral'] as const).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
      </InlineField>
      <InlineField label="Min volume" unit="div/day">
        <Input
          type="number"
          min={0}
          step={1}
          className="w-20"
          value={params.minVolume}
          onChange={(e) => update({ minVolume: Number(e.target.value) || 0 })}
        />
      </InlineField>
      <InlineField label="Min price" unit="div">
        <Input
          type="number"
          min={0}
          step={0.01}
          className="w-20"
          value={params.minPrice}
          onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
        />
      </InlineField>
    </FilterBar>
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
