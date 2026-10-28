import { CURRENCY_NAMES, type SellSignal } from '@poe-tools/shared';
import { useMemo } from 'react';
import { formatPercent } from '../../lib/format.ts';
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
  Select,
  StatTile,
  TypeChips,
} from '../../ui/index.ts';
import type { UnitInfo } from '../../lib/unit.ts';
import { useViewParams, type SortKey, type ViewParams } from './params.ts';
import { SellDetail } from './SellDetail.tsx';
import { SellTable } from './SellTable.tsx';
import { useSellSignals } from './useSellSignals.ts';
import { VERDICT_LABELS } from './VerdictBadge.tsx';

export default function SellNowPage() {
  const [params, update] = useViewParams();
  const { game, league, reference, today, data, signals, unit } = useSellSignals();

  const eligible = useMemo(
    () => filterAndSort(signals, { ...params, type: 'all', q: '' }),
    [signals, params],
  );
  const rows = useMemo(() => filterAndSort(signals, params), [signals, params]);
  const selected = params.item ? signals.find((s) => s.item.id === params.item) : undefined;

  if (!league || !reference) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Sell Now"
        description={
          <>
            What to sell: items at the point where they peaked in{' '}
            <span className="text-fg">{reference.name}</span>, or falling with no recovery last
            league.
          </>
        }
      />

      <LoadStatus state={data} what="price data" />
      {data.status === 'ready' && (
        <>
          <StatTiles
            signals={filterAndSort(signals, { ...params, type: 'all', q: '', verdict: 'all' })}
            today={today}
            leagueName={league.name}
            unit={unit}
          />

          <Card className="space-y-3">
            <TypeChips
              types={eligible.map((s) => s.item.type)}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <Filters params={params} update={update} unit={unit.short} />
          </Card>

          <SellTable
            rows={rows}
            params={params}
            currentHistory={data.data.currentHistory}
            today={today}
            unit={unit}
            onSort={(key: SortKey) =>
              update(
                params.sort === key
                  ? { desc: !params.desc }
                  : {
                      sort: key,
                      desc: !['name', 'sellDay', 'change1d', 'change3d', 'change7d'].includes(key),
                    },
              )
            }
            onSelect={(item) => update({ item })}
          />
          <p className="text-xs text-subtle">
            {rows.length} of {signals.length} items · expected loss is last league&apos;s move; in a
            market rising against the {CURRENCY_NAMES[unit.id]}, flagged items mostly lag the market
            rather than drop.
            {game === 'poe1' &&
              ' In PoE 1 the signal is weak: replayed on Allflame vs Mirage, flagged items did only slightly worse than the market afterwards — treat them as hints.'}
          </p>
          {selected && (
            <SellDetail
              signal={selected}
              reference={data.data.referenceHistory[selected.item.id] ?? []}
              current={data.data.currentHistory[selected.item.id] ?? []}
              referenceName={reference.name}
              currentName={league.name}
              today={today}
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
  signals,
  today,
  leagueName,
  unit,
}: {
  signals: readonly SellSignal[];
  today: number;
  leagueName: string;
  unit: UnitInfo;
}) {
  const count = (verdict: SellSignal['verdict']) =>
    signals.filter((s) => s.verdict === verdict).length;
  const top = signals
    .filter((s) => s.verdict === 'sell-now')
    .reduce<SellSignal | undefined>(
      (best, s) => (best && best.score >= s.score ? best : s),
      undefined,
    );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label={leagueName} value={`Day ${today}`} />
      <StatTile label="Sell now" value={count('sell-now')} tone="loss" />
      <StatTile label="Sell soon" value={count('sell-soon')} tone="warn" />
      <StatTile
        label="Most urgent"
        value={top ? formatPercent(-top.expectedLoss * 100) : '–'}
        tone="accent"
        detail={
          top ? (
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">{top.item.name}</span>
              <span aria-hidden>·</span>
              <Amount value={top.item.price} unit={unit} className="shrink-0" />
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
      <InlineField label="Show">
        <Select
          value={params.verdict}
          onChange={(e) => update({ verdict: e.target.value as ViewParams['verdict'] })}
        >
          <option value="flagged">
            {VERDICT_LABELS['sell-now']} + {VERDICT_LABELS['sell-soon']}
          </option>
          <option value="sell-now">{VERDICT_LABELS['sell-now']}</option>
          <option value="sell-soon">{VERDICT_LABELS['sell-soon']}</option>
          <option value="all">All, with {VERDICT_LABELS.hold}</option>
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

const VERDICT_ORDER: Record<SellSignal['verdict'], number> = {
  'sell-now': 0,
  'sell-soon': 1,
  hold: 2,
};

export function filterAndSort(signals: readonly SellSignal[], params: ViewParams): SellSignal[] {
  const q = params.q.trim().toLowerCase();
  const rows = signals.filter(
    (s) =>
      s.item.volume >= params.minVolume &&
      s.item.price >= params.minPrice &&
      (params.type === 'all' || s.item.type === params.type) &&
      (params.verdict === 'all' ||
        (params.verdict === 'flagged' ? s.verdict !== 'hold' : s.verdict === params.verdict)) &&
      (!q || s.item.name.toLowerCase().includes(q)),
  );
  const value = (s: SellSignal): number | string => {
    switch (params.sort) {
      case 'name':
        return s.item.name;
      case 'price':
        return s.item.price;
      case 'change1d':
        return s.change[1] ?? Infinity;
      case 'change3d':
        return s.change[3] ?? Infinity;
      case 'change7d':
        return s.change[7] ?? Infinity;
      case 'fromHigh':
        return s.fromHigh ?? -Infinity;
      case 'loss':
        return s.expectedLoss;
      case 'sellDay':
        return s.sellDay ?? Infinity;
      case 'confidence':
        return s.confidence;
      case 'volume':
        return s.item.volume;
      default:
        // Urgency: SELL NOW before SELL SOON before HOLD, then expected loss × confidence.
        return (2 - VERDICT_ORDER[s.verdict]) * 10 + s.score;
    }
  };
  return sortRows(rows, value, params.desc);
}
