import {
  EXCHANGE_TYPE_LABELS,
  HUBS,
  POE2_EXCHANGE_TYPES,
  getLeague,
  type CurrentItem,
  type Hub,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { fetchCurrent, fetchFlips, useAsync } from '../../lib/data.ts';
import { formatAge } from '../../lib/format.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';
import {
  Card,
  Chips,
  FilterBar,
  InlineField,
  Input,
  Notice,
  PageHeader,
  SearchInput,
  Segmented,
  Skeleton,
  StatTile,
} from '../../ui/index.ts';
import { FlipDetail } from './FlipDetail.tsx';
import { FlipsTable } from './FlipsTable.tsx';
import { filterAndSort, toRows, type FlipRow, type ViewParams } from './logic.ts';
import { useViewParams } from './params.ts';
import { formatMargin } from './parts.tsx';

const KINDS: { value: ViewParams['kind']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cross', label: 'Cross-pair' },
  { value: 'spread', label: 'Spread' },
];

/** Older exchange data than this (since the end of its hour) gets a warning. */
const STALE_MS = 3 * 3600_000;

export default function CurrencyFlippingPage() {
  const [params, update] = useViewParams();
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const now = useNow();

  const data = useAsync(`flipping:${settings.leagueId}`, async () => {
    if (!league) throw new Error('No league selected');
    const [current, flips] = await Promise.all([
      fetchCurrent(settings.game, league.id),
      fetchFlips(settings.game, league.id),
    ]);
    return { current, flips };
  });

  const items = useMemo(
    () =>
      new Map<string, CurrentItem>(
        data.status === 'ready' ? data.data.current.items.map((i) => [i.id, i]) : [],
      ),
    [data],
  );
  const hubIcons = useMemo(
    () =>
      Object.fromEntries(HUBS.map((hub) => [hub, items.get(hub)?.icon])) as Partial<
        Record<Hub, string>
      >,
    [items],
  );
  const allRows = useMemo(
    () => (data.status === 'ready' ? toRows(data.data.flips.flips, items, params.minMargin) : []),
    [data, items, params.minMargin],
  );
  const eligible = useMemo(
    () => filterAndSort(allRows, { ...params, type: 'all', q: '' }),
    [allRows, params],
  );
  const rows = useMemo(() => filterAndSort(allRows, params), [allRows, params]);
  const selected = params.flip ? allRows.find((r) => r.flip.id === params.flip) : undefined;

  if (!league) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Currency Flipping"
        description="Trades on the currency exchange that made a margin in the last hour, with the ratios to place in-game."
        actions={
          <Segmented
            label="Flip type"
            options={KINDS}
            value={params.kind}
            onChange={(kind) => update({ kind })}
          />
        }
      />

      <Notice>
        <strong>Beta — margins not verified in-game yet.</strong> They come from GGG&apos;s hourly
        exchange data (average prices of the last complete hour, 1–2 h old). Some large gaps may be
        data artefacts rather than real opportunities: check the live order book before trading.
      </Notice>

      {data.status === 'loading' && <Skeleton label="Loading exchange data" />}
      {data.status === 'error' && (
        <Notice>
          Exchange data couldn&apos;t be loaded ({data.error.message}). The data job may not have
          run yet.
        </Notice>
      )}
      {data.status === 'ready' && (
        <>
          <StatTiles
            rows={eligible}
            hours={data.data.flips.hours}
            leagueName={league.name}
            now={now}
          />

          <Card className="space-y-3">
            <CategoryChips
              rows={eligible}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <Filters params={params} update={update} />
          </Card>

          <FlipsTable
            rows={rows}
            params={params}
            hubIcons={hubIcons}
            onSort={(sort) =>
              update(
                params.sort === sort ? { desc: !params.desc } : { sort, desc: sort !== 'name' },
              )
            }
            onSelect={(flip) => update({ flip })}
          />
          <p className="text-xs text-subtle">
            {rows.length} of {allRows.length} flips · volume and value are over the last 24 h on the
            thinnest leg · prices are hourly averages from GGG&apos;s currency-exchange data.
          </p>
          {selected && (
            <FlipDetail
              row={selected}
              hours={data.data.flips.hours}
              minMargin={params.minMargin}
              hubIcons={hubIcons}
              onClose={() => update({ flip: null })}
            />
          )}
        </>
      )}
    </section>
  );
}

function StatTiles({
  rows,
  hours,
  leagueName,
  now,
}: {
  rows: readonly FlipRow[];
  hours: readonly number[];
  leagueName: string;
  now: number;
}) {
  const newest = hours.at(-1);
  const end = newest === undefined ? null : new Date((newest + 3600) * 1000);
  const stale = end === null || now - end.getTime() > STALE_MS;
  const best = (kind: 'cross' | 'spread') =>
    rows.filter((r) => r.flip.kind === kind).sort((a, b) => b.flip.margin - a.flip.margin)[0];
  const bestCross = best('cross');
  const bestSpread = best('spread');
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label={`${leagueName} · exchange data`}
        value={
          newest === undefined
            ? '–'
            : `${String(new Date(newest * 1000).getUTCHours()).padStart(2, '0')}:00 UTC`
        }
        tone={stale ? 'warn' : 'default'}
        detail={
          end
            ? `hour ended ${formatAge(end.toISOString(), now)}${stale ? ' · stale' : ''}`
            : 'no data'
        }
      />
      <StatTile label="Flips shown" value={rows.length} />
      <StatTile
        label="Best cross-pair"
        value={bestCross ? formatMargin(bestCross.flip.margin) : '–'}
        tone="gain"
        detail={bestCross?.item?.name}
      />
      <StatTile
        label="Best spread"
        value={bestSpread ? formatMargin(bestSpread.flip.margin) : '–'}
        tone="gain"
        detail={bestSpread?.item?.name}
      />
    </div>
  );
}

function CategoryChips({
  rows,
  value,
  onChange,
}: {
  rows: readonly FlipRow[];
  value: ViewParams['type'];
  onChange: (value: ViewParams['type']) => void;
}) {
  const counts = new Map<string, number>();
  for (const { item } of rows) if (item) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  return (
    <Chips<ViewParams['type']>
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', count: rows.length },
        ...POE2_EXCHANGE_TYPES.filter((t) => counts.get(t)).map((t) => ({
          value: t,
          label: EXCHANGE_TYPE_LABELS[t],
          count: counts.get(t) ?? 0,
        })),
      ]}
    />
  );
}

function NumberField({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <InlineField label={label} unit={unit}>
      <Input
        type="number"
        min={0}
        step={step}
        className="w-20"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </InlineField>
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
      <NumberField
        label="Min volume"
        unit="items/24 h"
        step={10}
        value={params.minUnits}
        onChange={(minUnits) => update({ minUnits })}
      />
      <NumberField
        label="Min value"
        unit="div/24 h"
        step={10}
        value={params.minValue}
        onChange={(minValue) => update({ minValue })}
      />
      <NumberField
        label="Min margin"
        unit="%"
        step={1}
        value={params.minMargin}
        onChange={(minMargin) => update({ minMargin })}
      />
      <NumberField
        label="Recurrence"
        unit="% of hours"
        step={5}
        value={params.minRecurrence}
        onChange={(minRecurrence) => update({ minRecurrence })}
      />
    </FilterBar>
  );
}
