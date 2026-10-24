import { FARM_START_DAY, type FarmSignal } from '@poe-tools/shared';
import { useMemo } from 'react';
import { formatPercent } from '../../lib/format.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import {
  Amount,
  Card,
  FilterBar,
  InlineField,
  Input,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  StatTile,
} from '../../ui/index.ts';
import { FarmDetail } from './FarmDetail.tsx';
import { FarmTable, mechanicKey, mechanicLabel } from './FarmTable.tsx';
import { useViewParams, type SortKey, type ViewParams } from './params.ts';
import { useFarmSignals } from './useFarmSignals.ts';
import { VERDICT_LABELS } from './VerdictBadge.tsx';

export default function WhatToFarmPage() {
  const [params, update] = useViewParams();
  const { game, league, reference, today, data, signals, unit } = useFarmSignals(params);

  const rows = useMemo(() => filterAndSort(signals, params), [signals, params]);
  const selected = params.mechanic
    ? signals.find((s) => mechanicKey(s) === params.mechanic)
    : undefined;

  if (!league || !reference) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <PageHeader
        title="What to Farm"
        description={
          <>
            Which league mechanics drop the best loot to sell right now: what it is worth, how much
            of it trades, and how it moved in <span className="text-fg">{reference.name}</span>. No
            drop rates: this ranks loot, not profit per map.
          </>
        }
      />

      {today < FARM_START_DAY ? (
        <Notice>
          Waiting for data: verdicts start on day {FARM_START_DAY} of {league.name}, once a week of
          prices shows how each mechanic&apos;s loot moves (today is day {Math.max(0, today)}).
        </Notice>
      ) : (
        <>
          {data.status === 'loading' && <Skeleton label="Loading price data" />}
          {data.status === 'error' && (
            <Notice>
              Price data couldn&apos;t be loaded ({data.error.message}). The data job may not have
              run yet.
            </Notice>
          )}
          {data.status === 'ready' && (
            <>
              <StatTiles signals={signals} today={today} leagueName={league.name} unit={unit} />

              <Card>
                <Filters params={params} update={update} unit={unit.short} />
              </Card>

              <FarmTable
                rows={rows}
                params={params}
                today={today}
                unit={unit}
                onSort={(key: SortKey) =>
                  update(
                    params.sort === key
                      ? { desc: !params.desc }
                      : { sort: key, desc: key !== 'mechanic' },
                  )
                }
                onSelect={(mechanic) => update({ mechanic })}
              />
              <p className="text-xs text-subtle">
                {rows.filter((s) => s.mechanic).length} mechanics · trend and last league are
                relative to the market (median of liquid items). Replayed on past days, the verdicts
                were only a weak guide (FARM &amp; HOLD loot beat FARM &amp; SELL by a few percent
                {game === 'poe2' ? '; in PoE 2 AVOID did not lag' : ''}) — treat them as hints.
                Scarabs and other map inputs are left out.
              </p>
              {selected && (
                <FarmDetail
                  signal={selected}
                  referenceName={reference.name}
                  currentName={league.name}
                  today={today}
                  unit={unit}
                  onClose={() => update({ mechanic: null })}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function StatTiles({
  signals,
  today,
  leagueName,
  unit,
}: {
  signals: readonly FarmSignal[];
  today: number;
  leagueName: string;
  unit: UnitInfo;
}) {
  const count = (verdict: FarmSignal['verdict']) =>
    signals.filter((s) => s.verdict === verdict).length;
  const best = filterAndSort(signals, {
    show: 'farm',
    minVolume: 0,
    minPrice: 0,
    sort: 'score',
    desc: true,
    mechanic: null,
  }).find((s) => s.mechanic !== null);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label={leagueName} value={`Day ${today}`} />
      <StatTile label={VERDICT_LABELS['farm-hold']} value={count('farm-hold')} tone="gain" />
      <StatTile label={VERDICT_LABELS.avoid} value={count('avoid')} tone="loss" />
      <StatTile
        label="Top pick"
        value={best ? mechanicLabel(best) : '–'}
        tone="accent"
        detail={
          best ? (
            <span className="flex min-w-0 items-center gap-1">
              <span>{formatPercent(best.outlook === null ? null : (best.outlook - 1) * 100)}</span>
              <span aria-hidden>·</span>
              <Amount value={best.marketSize} unit={unit} className="shrink-0" />
              <span>/ day</span>
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
  params: ViewParams;
  update: (p: Partial<ViewParams>) => void;
  unit: string;
}) {
  return (
    <FilterBar>
      <InlineField label="Show">
        <Select
          value={params.show}
          onChange={(e) => update({ show: e.target.value as ViewParams['show'] })}
        >
          <option value="all">All mechanics</option>
          <option value="farm">
            {VERDICT_LABELS['farm-hold']} + {VERDICT_LABELS['farm-sell']}
          </option>
        </Select>
      </InlineField>
      <InlineField label="Min item volume" unit={`${unit}/day`}>
        <Input
          type="number"
          min={0}
          step={1}
          className="w-20"
          value={params.minVolume}
          onChange={(e) => update({ minVolume: Number(e.target.value) || 0 })}
        />
      </InlineField>
      <InlineField label="Min item price" unit={unit}>
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

const VERDICT_ORDER: Record<NonNullable<FarmSignal['verdict']>, number> = {
  'farm-hold': 0,
  'farm-sell': 1,
  thin: 2,
  avoid: 3,
};

/** Rows to show, sorted; the baseline row stays in the list (no verdict, ranked by score). */
export function filterAndSort(signals: readonly FarmSignal[], params: ViewParams): FarmSignal[] {
  const rows = signals.filter(
    (s) =>
      params.show === 'all' ||
      s.verdict === null ||
      s.verdict === 'farm-hold' ||
      s.verdict === 'farm-sell',
  );
  const value = (s: FarmSignal): number | string => {
    switch (params.sort) {
      case 'mechanic':
        return mechanicLabel(s);
      case 'value':
        return s.lootValue;
      case 'size':
        return s.marketSize;
      case 'items':
        return s.items.length;
      case 'trend':
        return s.trend ?? -Infinity;
      case 'outlook':
        return s.outlook ?? -Infinity;
      case 'confidence':
        return s.mechanic ? s.confidence : -Infinity;
      default: {
        // FARM & HOLD, FARM & SELL, THIN, AVOID; then (outlook − 1) × confidence. The baseline sits
        // between FARM & SELL and THIN, for comparison.
        const order = s.verdict === null ? 1.5 : VERDICT_ORDER[s.verdict];
        return (3 - order) * 10 + s.score;
      }
    }
  };
  return rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number);
    return params.desc ? -cmp : cmp;
  });
}
