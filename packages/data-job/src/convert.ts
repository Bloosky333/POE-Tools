import type { CurrentItem, ExchangeType } from '@poe-tools/shared';
import { NINJA_BASE_URL } from './poe-ninja/client.ts';
import type { ExchangeDetails, ExchangeOverview } from './poe-ninja/schemas.ts';

/** One price observation of an item on a UTC calendar date, in divine. */
export interface DailyPoint {
  date: string;
  item: string;
  price: number;
  volume: number;
  source: 'details' | 'snapshot';
}

/** Units of exalted / chaos per 1 divine on a date. */
export interface FxPoint {
  date: string;
  exalted: number | null;
  chaos: number | null;
}

export const DIVINE_ID = 'divine';

/** Keeps 6 significant digits: plenty for prices, keeps files small. */
export function round(value: number): number {
  return Number(value.toPrecision(6));
}

export function overviewToItems(overview: ExchangeOverview, type: ExchangeType): CurrentItem[] {
  const meta = new Map(overview.items.map((item) => [item.id, item]));
  return overview.lines.flatMap((line) => {
    const item = meta.get(line.id);
    if (!item) return [];
    return [
      {
        id: line.id,
        detailsId: item.detailsId,
        name: item.name,
        icon: item.image ? new URL(item.image, NINJA_BASE_URL).toString() : '',
        type,
        price: round(line.primaryValue),
        volume: round(line.volumePrimaryValue ?? 0),
        change7d: line.sparkline?.totalChange ?? null,
      },
    ];
  });
}

/** Today's exchange rates from an overview `core` block. */
export function fxFromOverview(overview: ExchangeOverview, date: string): FxPoint {
  return {
    date,
    exalted: overview.core.rates.exalted ?? null,
    chaos: overview.core.rates.chaos ?? null,
  };
}

/** Daily exalted/chaos per divine from the Divine Orb details (pair rate = units per divine). */
export function fxFromDivineDetails(details: ExchangeDetails, beforeDate: string): FxPoint[] {
  const byDate = new Map<string, FxPoint>();
  for (const pair of details.pairs) {
    if (pair.id !== 'exalted' && pair.id !== 'chaos') continue;
    for (const point of pair.history) {
      const date = point.timestamp.slice(0, 10);
      if (date >= beforeDate) continue;
      const fx = byDate.get(date) ?? { date, exalted: null, chaos: null };
      fx[pair.id] = point.rate;
      byDate.set(date, fx);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Converts an item's per-pair history into one daily price in divine: a volume-weighted
 * mean of every pair converted with that day's rates. Only completed days
 * (`date < beforeDate`) are kept, since the latest point is the running day.
 */
export function detailsToDailyPoints(
  details: ExchangeDetails,
  itemId: string,
  fx: ReadonlyMap<string, FxPoint>,
  beforeDate: string,
): DailyPoint[] {
  const acc = new Map<string, { weighted: number; volume: number; sum: number; n: number }>();
  for (const pair of details.pairs) {
    for (const point of pair.history) {
      const date = point.timestamp.slice(0, 10);
      if (date >= beforeDate) continue;
      const divPerUnit = divinePerUnit(pair.id, fx.get(date));
      if (divPerUnit === null) continue;
      const price = point.rate * divPerUnit;
      const volume = point.volumePrimaryValue ?? 0;
      const day = acc.get(date) ?? { weighted: 0, volume: 0, sum: 0, n: 0 };
      day.weighted += price * volume;
      day.volume += volume;
      day.sum += price;
      day.n += 1;
      acc.set(date, day);
    }
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      item: itemId,
      price: round(day.volume > 0 ? day.weighted / day.volume : day.sum / day.n),
      volume: round(day.volume),
      source: 'details' as const,
    }));
}

function divinePerUnit(currency: string, fx: FxPoint | undefined): number | null {
  if (currency === DIVINE_ID) return 1;
  const rate = currency === 'exalted' ? fx?.exalted : currency === 'chaos' ? fx?.chaos : null;
  return rate ? 1 / rate : null;
}
