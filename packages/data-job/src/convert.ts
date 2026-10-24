import type { CoreCurrency, CurrentItem, ExchangeType } from '@poe-tools/shared';
import type { ExchangeDetails, ExchangeOverview } from './poe-ninja/schemas.ts';

/** One price observation of an item on a UTC calendar date, in the game's unit. */
export interface DailyPoint {
  date: string;
  item: string;
  price: number;
  volume: number;
  source: 'details' | 'snapshot';
}

/** Units of other core currencies per 1 unit of the game (PoE 2: per divine) on a date. */
export interface FxPoint {
  date: string;
  rates: Partial<Record<CoreCurrency, number>>;
}

/** poe.ninja `detailsId` of each core currency (its own item). */
export const CURRENCY_DETAILS_ID: Record<CoreCurrency, string> = {
  divine: 'divine-orb',
  exalted: 'exalted-orb',
  chaos: 'chaos-orb',
};

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
        // GGG image path (`/gen/image/...`); replaced by the self-hosted file in syncIcons.
        icon: item.image ?? '',
        type,
        price: round(line.primaryValue),
        volume: round(line.volumePrimaryValue ?? 0),
        change7d: line.sparkline?.totalChange ?? null,
      },
    ];
  });
}

/** Today's exchange rates (units per 1 unit) of `currencies` from an overview `core` block. */
export function fxFromOverview(
  overview: ExchangeOverview,
  date: string,
  currencies: readonly CoreCurrency[],
): FxPoint {
  const rates: FxPoint['rates'] = {};
  for (const currency of currencies) {
    const rate = overview.core.rates[currency];
    if (rate) rates[currency] = rate;
  }
  return { date, rates };
}

/**
 * Daily rates of `currencies` from the details of the unit's own item (PoE 2: Divine Orb,
 * PoE 1: Chaos Orb), whose pair rate is units of the pair currency per 1 unit.
 */
export function fxFromUnitDetails(
  details: ExchangeDetails,
  beforeDate: string,
  currencies: readonly CoreCurrency[],
): FxPoint[] {
  const byDate = new Map<string, FxPoint>();
  for (const pair of details.pairs) {
    const currency = currencies.find((c) => c === pair.id);
    if (!currency) continue;
    for (const point of pair.history) {
      const date = point.timestamp.slice(0, 10);
      if (date >= beforeDate || !point.rate) continue;
      const fx = byDate.get(date) ?? { date, rates: {} };
      fx.rates[currency] = point.rate;
      byDate.set(date, fx);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Converts an item's per-pair history into one daily price in the game's unit: the
 * volume-weighted average price actually paid over all pairs that day
 * (Σ divine traded / Σ items traded).
 *
 * Pairs can disagree a lot on cheap items (a 0.03 div item bought with divines trades in
 * lots at a worse rate; thin pairs drift), and picking one pair per day — as the overview
 * does — makes the series jump between pairs, which would show fake price moves. The
 * average is stable. Only completed days (`date < beforeDate`) are kept, since the
 * latest point is the running day.
 */
export function detailsToDailyPoints(
  details: ExchangeDetails,
  itemId: string,
  fx: ReadonlyMap<string, FxPoint>,
  beforeDate: string,
  unit: CoreCurrency = 'divine',
): DailyPoint[] {
  const days = new Map<string, { volume: number; units: number; prices: number[] }>();
  for (const pair of details.pairs) {
    for (const point of pair.history) {
      const date = point.timestamp.slice(0, 10);
      const perPairUnit = unitPerPairUnit(pair.id, unit, fx.get(date));
      if (date >= beforeDate || !point.rate || perPairUnit === null) continue;
      const price = point.rate * perPairUnit;
      const volume = point.volumePrimaryValue ?? 0;
      const day = days.get(date) ?? { volume: 0, units: 0, prices: [] };
      day.volume += volume;
      day.units += volume / price;
      day.prices.push(price);
      days.set(date, day);
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      item: itemId,
      price: round(day.units > 0 ? day.volume / day.units : median(day.prices)),
      volume: round(day.volume),
      source: 'details' as const,
    }));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Value of 1 `currency` in the game's unit on a day (null: no rate). */
function unitPerPairUnit(currency: string, unit: CoreCurrency, fx: FxPoint | undefined) {
  if (currency === unit) return 1;
  const rate = fx?.rates[currency as CoreCurrency];
  return rate ? 1 / rate : null;
}
