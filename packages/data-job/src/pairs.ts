import {
  DAY_MS,
  PAY_CURRENCIES,
  utcDate,
  type PairQuote,
  type PairsFile,
  type PayCurrency,
} from '@poe-tools/shared';
import { round } from './convert.ts';
import type { ExchangeDetails, ExchangeOverview } from './poe-ninja/schemas.ts';

/*
 * Per-pair rates for tool #2 (spec 04). Directions, verified against the probe fixtures:
 * the details `rate` is units of the pair currency per item; the overview `maxVolumeRate`
 * is the inverse (items per unit of the pair currency).
 */

/** One day of an item traded against one pay currency. */
export interface PairPoint {
  date: string;
  item: string;
  pair: PayCurrency;
  /** Units of `pair` per 1 item. */
  rate: number;
  /** Volume traded on this pair that day, in the game unit (divine for PoE 2, chaos for PoE 1). */
  volume: number;
}

/** Busiest pair of an item from an hourly overview, `rate` in units of `pair` per item. */
export interface BusiestPair {
  pair: PayCurrency;
  rate: number;
}

/** Daily rates per pay currency; only completed days (`date < beforeDate`). */
export function detailsToPairPoints(
  details: ExchangeDetails,
  itemId: string,
  beforeDate: string,
): PairPoint[] {
  const points: PairPoint[] = [];
  for (const pair of details.pairs) {
    if (!isPayCurrency(pair.id) || pair.id === itemId) continue;
    for (const point of pair.history) {
      const date = point.timestamp.slice(0, 10);
      if (date >= beforeDate || !point.rate) continue;
      points.push({
        date,
        item: itemId,
        pair: pair.id,
        rate: round(point.rate),
        volume: round(point.volumePrimaryValue ?? 0),
      });
    }
  }
  return points;
}

export function busiestPairs(overviews: readonly ExchangeOverview[]): Map<string, BusiestPair> {
  const result = new Map<string, BusiestPair>();
  for (const overview of overviews) {
    for (const line of overview.lines) {
      const pair = line.maxVolumeCurrency;
      if (!pair || !isPayCurrency(pair) || pair === line.id || !line.maxVolumeRate) continue;
      if (!result.has(line.id)) result.set(line.id, { pair, rate: round(1 / line.maxVolumeRate) });
    }
  }
  return result;
}

/**
 * Latest quote per item and pay currency: the newest stored day (at most `maxAgeDays`
 * old), overridden by the hourly busiest pair, which is always fresher. The daily volume
 * is kept on an overridden pair since the overview has no per-pair volume.
 */
export function buildPairQuotes(
  points: readonly PairPoint[],
  busiest: ReadonlyMap<string, BusiestPair>,
  now: Date,
  maxAgeDays = 7,
): PairsFile['items'] {
  const oldest = utcDate(now.getTime() - maxAgeDays * DAY_MS);
  const latest = new Map<string, PairPoint>();
  for (const point of points) {
    if (point.date < oldest) continue;
    const key = `${point.item}|${point.pair}`;
    const current = latest.get(key);
    if (!current || current.date < point.date) latest.set(key, point);
  }

  const items: PairsFile['items'] = {};
  for (const point of latest.values()) {
    const quote: PairQuote = {
      rate: point.rate,
      volume: point.volume,
      asOf: new Date(Date.parse(point.date) + DAY_MS).toISOString(),
      source: 'daily',
    };
    (items[point.item] ??= {})[point.pair] = quote;
  }
  for (const [item, { pair, rate }] of busiest) {
    const quotes = (items[item] ??= {});
    quotes[pair] = {
      rate,
      volume: quotes[pair]?.volume ?? null,
      asOf: now.toISOString(),
      source: 'hourly',
    };
  }
  return items;
}

function isPayCurrency(id: string): id is PayCurrency {
  return (PAY_CURRENCIES as readonly string[]).includes(id);
}
