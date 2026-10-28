import {
  ECONOMY,
  marketChanges,
  sellSettingsFor,
  sellSignal,
  type Suggestion,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { formatMultiplier } from '../../lib/format.ts';
import { sortRows } from '../../lib/sort.ts';
import {
  Card,
  Amount,
  FilterBar,
  InlineField,
  LoadStatus,
  NumberField,
  PageHeader,
  SearchInput,
  Segmented,
  Select,
  StatTile,
  TypeChips,
} from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import { ACTION_LABELS } from './ActionBadge.tsx';
import { ItemDetail } from './ItemDetail.tsx';
import { MODES, useViewParams, type SortKey, type ViewParams } from './params.ts';
import { SuggestionsTable } from './SuggestionsTable.tsx';
import { useSuggestions } from './useSuggestions.ts';

export default function CurrencySpeculationPage() {
  const [params, update] = useViewParams();
  const mode = MODES.find((m) => m.value === params.mode)?.mode ?? { kind: 'horizon', days: 14 };
  const { game, league, reference, today, data, suggestions, unit, marketFactor } = useSuggestions(
    mode,
    params.minVolume,
  );

  const eligible = useMemo(
    () => filterAndSort(suggestions, { ...params, type: 'all', action: 'all', q: '' }),
    [suggestions, params],
  );
  const rows = useMemo(() => filterAndSort(suggestions, params), [suggestions, params]);
  const selected = params.item ? suggestions.find((s) => s.item.id === params.item) : undefined;
  const sell = useMemo(() => {
    if (!selected || data.status !== 'ready') return undefined;
    const { current, currentHistory, referenceHistory } = data.data;
    return sellSignal({
      item: selected.item,
      reference: referenceHistory[selected.item.id],
      current: currentHistory[selected.item.id],
      today,
      market: marketChanges(current.items, currentHistory, today, ECONOMY[game]),
      settings: sellSettingsFor(game),
    });
  }, [selected, data, today, game]);

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

      <LoadStatus state={data} what="price data" />
      {data.status === 'ready' && (
        <>
          <StatTiles suggestions={eligible} today={today} leagueName={league.name} unit={unit} />

          <Card className="space-y-3">
            <TypeChips
              types={eligible.map((s) => s.item.type)}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <Filters params={params} update={update} unit={unit.short} />
          </Card>

          <SuggestionsTable
            rows={rows}
            params={params}
            currentHistory={data.data.currentHistory}
            today={today}
            unit={unit}
            onSort={(key: SortKey) =>
              update(
                params.sort === key ? { desc: !params.desc } : { sort: key, desc: key !== 'name' },
              )
            }
            onSelect={(item) => update({ item })}
          />
          <p className="text-xs text-subtle">
            {rows.length} of {suggestions.length} items · history prices are daily averages paid
            across the currencies it trades against.
          </p>
          {selected && (
            <ItemDetail
              suggestion={selected}
              reference={data.data.referenceHistory[selected.item.id] ?? []}
              current={data.data.currentHistory[selected.item.id] ?? []}
              referenceName={reference.name}
              currentName={league.name}
              today={today}
              marketFactor={marketFactor}
              sell={sell}
              unit={unit}
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
  unit,
}: {
  suggestions: readonly Suggestion[];
  today: number;
  leagueName: string;
  unit: UnitInfo;
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
        value={best ? formatMultiplier(best.reference?.expectedMultiplier) : '–'}
        tone="accent"
        detail={
          best ? (
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">{best.item.name}</span>
              <span aria-hidden>·</span>
              <Amount value={best.item.price} unit={unit} className="shrink-0" />
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

function Filters({
  params,
  update,
  unit,
}: {
  unit: string;
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
      <NumberField
        label="Min volume"
        unit={`${unit}/day`}
        step={1}
        value={params.minVolume}
        onChange={(minVolume) => update({ minVolume })}
      />
      <NumberField
        label="Min price"
        unit={unit}
        step={0.01}
        value={params.minPrice}
        onChange={(minPrice) => update({ minPrice })}
      />
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
        return s.reference?.expectedMultiplier ?? -Infinity;
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
  return sortRows(rows, value, params.desc);
}
