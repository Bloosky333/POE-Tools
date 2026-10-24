import {
  DEFAULT_ENGINE_SETTINGS,
  EXCHANGE_TYPE_LABELS,
  POE2_EXCHANGE_TYPES,
  getLeague,
  getReferenceLeague,
  leagueDay,
  suggest,
  type Suggestion,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { fetchCurrent, fetchLeagueHistory, useAsync } from '../../lib/data.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';
import { ACTION_LABELS } from './ActionBadge.tsx';
import { ItemDetail } from './ItemDetail.tsx';
import { MODES, useViewParams, type SortKey, type ViewParams } from './params.ts';
import { SuggestionsTable } from './SuggestionsTable.tsx';

export default function CurrencySpeculationPage() {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const reference = league && getReferenceLeague(league);
  const [params, update] = useViewParams();

  const data = useAsync(`speculation:${settings.leagueId}`, async () => {
    if (!league || !reference) throw new Error('No reference league configured');
    const [current, currentHistory, referenceHistory] = await Promise.all([
      fetchCurrent(settings.game, league.id),
      fetchLeagueHistory(settings.game, league.id),
      fetchLeagueHistory(settings.game, reference.id),
    ]);
    return { current, currentHistory, referenceHistory };
  });

  const now = useNow();
  const today = league ? leagueDay(league.startsAt, new Date(now)) : 0;

  const suggestions = useMemo(() => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    const mode = MODES.find((m) => m.value === params.mode)?.mode ?? {
      kind: 'horizon',
      days: 14,
    };
    return current.items
      .filter((item) => item.id !== 'divine')
      .map((item) =>
        suggest({
          item,
          reference: referenceHistory[item.id],
          current: currentHistory[item.id],
          today,
          mode,
          settings: { ...DEFAULT_ENGINE_SETTINGS, minVolume: params.minVolume },
        }),
      );
  }, [data, today, params.mode, params.minVolume]);

  const rows = useMemo(() => filterAndSort(suggestions, params), [suggestions, params]);
  const selected = params.item ? suggestions.find((s) => s.item.id === params.item) : undefined;

  if (!league || !reference) return <p>No league selected.</p>;

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Currency Speculation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {league.name}: day {today} · compared with {reference.name} at the same day · prices in
          divine
        </p>
      </header>

      <Controls params={params} update={update} />

      {data.status === 'loading' && <p className="text-sm text-gray-500">Loading price data…</p>}
      {data.status === 'error' && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          ⚠ Price data couldn't be loaded ({data.error.message}). The data job may not have run yet.
        </p>
      )}
      {data.status === 'ready' && (
        <>
          <Summary suggestions={rows} />
          <SuggestionsTable
            rows={rows}
            params={params}
            onSort={(key: SortKey) =>
              update(
                params.sort === key ? { desc: !params.desc } : { sort: key, desc: key !== 'name' },
              )
            }
            onSelect={(item) => update({ item })}
          />
          {selected && (
            <ItemDetail
              suggestion={selected}
              reference={data.data.referenceHistory[selected.item.id] ?? []}
              current={data.data.currentHistory[selected.item.id] ?? []}
              referenceName={reference.name}
              currentName={league.name}
              today={today}
              onClose={() => update({ item: null })}
            />
          )}
        </>
      )}
    </section>
  );
}

function Summary({ suggestions }: { suggestions: readonly Suggestion[] }) {
  const count = (action: Suggestion['action']) =>
    suggestions.filter((s) => s.action === action).length;
  return (
    <p className="text-sm text-gray-600 dark:text-gray-300">
      {suggestions.length} items · {count('buy')} buy now · {count('wait')} wait · {count('avoid')}{' '}
      avoid
    </p>
  );
}

const inputClass =
  'rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900';

function Controls({
  params,
  update,
}: {
  params: ViewParams;
  update: (p: Partial<ViewParams>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <Field label="Sell">
        <select
          className={inputClass}
          value={params.mode}
          onChange={(e) => update({ mode: e.target.value })}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Action">
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
      </Field>
      <Field label="Category">
        <select
          className={inputClass}
          value={params.type}
          onChange={(e) => update({ type: e.target.value as ViewParams['type'] })}
        >
          <option value="all">All</option>
          {POE2_EXCHANGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EXCHANGE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Min volume (div/day)">
        <input
          type="number"
          min={0}
          step={1}
          className={`${inputClass} w-24`}
          value={params.minVolume}
          onChange={(e) => update({ minVolume: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Min price (div)">
        <input
          type="number"
          min={0}
          step={0.01}
          className={`${inputClass} w-24`}
          value={params.minPrice}
          onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Search">
        <input
          type="search"
          placeholder="Item name"
          className={`${inputClass} w-44`}
          value={params.q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
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
