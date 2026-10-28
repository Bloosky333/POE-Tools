import { ECONOMY, type Game } from '../games.ts';
import type { Flip, FlipLeg, FlipsFile, Hub } from './data.ts';

/*
 * Currency Flipping engine (spec 04, §5). Input: hourly digests of the currency exchange,
 * reduced to markets between an item and a hub currency. A price `p` is in hub units per
 * 1 item; `avg` is the hour's volume-weighted average (hubVolume / itemVolume).
 */

/** One market (item ↔ hub) during one hour. Hub ↔ hub markets use the rule of `marketSides`. */
export interface MarketHour {
  item: string;
  hub: Hub;
  itemVolume: number;
  hubVolume: number;
  /** Lowest / highest ratio of the hour, in hub units per 1 item. */
  low: number;
  high: number;
}

export interface ExchangeHour {
  /** Start of the UTC hour, unix seconds. */
  epoch: number;
  markets: MarketHour[];
}

export interface FlipSettings {
  /** Hours whose `high / low` exceeds this are treated as outliers (spread margin null). */
  maxRangeRatio: number;
  /** Flips with a leg trading less than this (`unit`, whole window) are not published. */
  minLegValue: number;
  /** Hub currencies of the game's exchange. */
  hubs: readonly Hub[];
  /** Unit of values (`value24h`): one of the hubs. */
  unit: Hub;
}

export function flipSettingsFor(game: Game): FlipSettings {
  const economy = ECONOMY[game];
  return {
    maxRangeRatio: 3,
    minLegValue: economy.flipMinLegValue,
    hubs: economy.hubs,
    unit: economy.unit,
  };
}

/** Rank of the hubs: in a hub ↔ hub market, the higher-ranked one is the `hub` side. */
const HUB_RANK: Record<Hub, number> = { divine: 0, exalted: 1, chaos: 2 };

/** Item and hub sides of a market between two hub currencies. */
export function marketSides(a: Hub, b: Hub): { item: Hub; hub: Hub } {
  return HUB_RANK[a] < HUB_RANK[b] ? { item: b, hub: a } : { item: a, hub: b };
}

interface Leg {
  avg: number;
  low: number;
  high: number;
  units: number;
  /** Value traded on this leg during the hour, in the settings' unit. */
  value: number;
}

interface HourView {
  /** Value of 1 unit of each hub, in the settings' unit. */
  value: Partial<Record<Hub, number>>;
  legs: Map<string, Map<Hub, Leg>>;
  markets: MarketHour[];
}

const avgOf = (m: MarketHour) => m.hubVolume / m.itemVolume;

/**
 * Value of each hub in the settings' unit, from the hub ↔ hub markets of the hour: a hub
 * traded directly against an already valued hub first, then through another hub; a hub
 * not traded this hour keeps its value of the previous hour.
 */
function hubValues(
  traded: readonly MarketHour[],
  previous: Partial<Record<Hub, number>> | null,
  settings: FlipSettings,
): Partial<Record<Hub, number>> | null {
  const value: Partial<Record<Hub, number>> = { [settings.unit]: 1 };
  const isHub = (id: string): id is Hub => (settings.hubs as readonly string[]).includes(id);
  for (let pass = 0; pass < settings.hubs.length; pass++) {
    for (const m of traded) {
      if (!isHub(m.item)) continue;
      const itemValue = value[m.item];
      const hubValue = value[m.hub];
      // Market `item` ↔ `hub`: 1 item = avg hub units.
      if (itemValue === undefined && hubValue !== undefined) value[m.item] = avgOf(m) * hubValue;
      if (hubValue === undefined && itemValue !== undefined) value[m.hub] = itemValue / avgOf(m);
    }
  }
  for (const hub of settings.hubs) {
    const last = previous?.[hub];
    if (value[hub] === undefined && last !== undefined) value[hub] = last;
  }
  return settings.hubs.every((hub) => value[hub]) ? value : null;
}

function viewHour(
  hour: ExchangeHour,
  previous: Partial<Record<Hub, number>> | null,
  settings: FlipSettings,
): HourView | null {
  const traded = hour.markets.filter((m) => m.itemVolume > 0 && m.hubVolume > 0);
  const value = hubValues(traded, previous, settings);
  if (!value) return null;

  const legs = new Map<string, Map<Hub, Leg>>();
  for (const m of traded) {
    const byHub = legs.get(m.item) ?? new Map<Hub, Leg>();
    byHub.set(m.hub, {
      avg: avgOf(m),
      low: Math.min(m.low, m.high),
      high: Math.max(m.low, m.high),
      units: m.itemVolume,
      value: m.hubVolume * (value[m.hub] ?? 0),
    });
    legs.set(m.item, byHub);
  }
  return { value, legs, markets: traded };
}

/**
 * Units of `to` received per 1 `from`: hour average and most favourable end of the range;
 * null when the `from` ↔ `to` market did not trade that hour (spec 04 §7: the flip is not
 * doable then, so it is skipped rather than priced with an older or derived rate).
 */
function conversion(view: HourView, from: Hub, to: Hub): { avg: number; best: number } | null {
  const sides = marketSides(from, to);
  const market = view.markets.find((m) => m.item === sides.item && m.hub === sides.hub);
  if (!market) return null;
  const low = Math.min(market.low, market.high);
  const high = Math.max(market.low, market.high);
  // Selling the item side gives `p` hub units; selling the hub side gives 1 / p items.
  return from === sides.item
    ? { avg: avgOf(market), best: high }
    : { avg: 1 / avgOf(market), best: 1 / low };
}

interface Candidate {
  kind: Flip['kind'];
  item: string;
  buyHub: Hub;
  sellHub: Hub;
}

const keyOf = (c: Candidate) => `${c.kind}:${c.item}:${c.buyHub}:${c.sellHub}`;

function marginIn(view: HourView, c: Candidate, settings: FlipSettings): number | null {
  const legs = view.legs.get(c.item);
  const buy = legs?.get(c.buyHub);
  const sell = legs?.get(c.sellHub);
  if (!buy || !sell) return null;
  if (c.kind === 'spread') {
    const ratio = buy.high / buy.low;
    return ratio > settings.maxRangeRatio ? null : ratio - 1;
  }
  // Pay buyHub for the item, sell it for sellHub, convert sellHub back to buyHub.
  const rate = conversion(view, c.sellHub, c.buyHub);
  return rate ? (sell.avg * rate.avg) / buy.avg - 1 : null;
}

function candidatesOf(view: HourView): Candidate[] {
  const out: Candidate[] = [];
  for (const [item, byHub] of view.legs) {
    const hubs = [...byHub.keys()];
    for (const hub of hubs) out.push({ kind: 'spread', item, buyHub: hub, sellHub: hub });
    for (const buyHub of hubs)
      for (const sellHub of hubs)
        if (buyHub !== sellHub) out.push({ kind: 'cross', item, buyHub, sellHub });
  }
  return out;
}

/** Keeps 6 significant digits: plenty for prices, keeps files small. */
const round = (value: number) => Number(value.toPrecision(6));

/**
 * Flips of the newest hour of `hours` (ascending by epoch), with their hourly margins over
 * the whole window. Only flips with a positive margin in the newest hour are returned; for
 * cross-pair flips only the best direction of each item is kept.
 */
export function computeFlips(
  leagueId: string,
  hours: readonly ExchangeHour[],
  generatedAt: Date,
  settings: FlipSettings,
): FlipsFile {
  const views: (HourView | null)[] = [];
  let previous: Partial<Record<Hub, number>> | null = null;
  for (const hour of hours) {
    const view = viewHour(hour, previous, settings);
    if (view) previous = view.value;
    views.push(view);
  }
  const file: FlipsFile = {
    version: 1,
    leagueId,
    generatedAt: generatedAt.toISOString(),
    hours: hours.map((h) => h.epoch),
    flips: [],
  };
  const newest = views.at(-1);
  if (!newest) return file;

  // Window totals per leg (item ↔ hub market).
  const totals = new Map<string, { units: number; value: number }>();
  for (const view of views) {
    for (const [item, byHub] of view?.legs ?? []) {
      for (const [hub, leg] of byHub) {
        const total = totals.get(`${item}:${hub}`) ?? { units: 0, value: 0 };
        total.units += leg.units;
        total.value += leg.value;
        totals.set(`${item}:${hub}`, total);
      }
    }
  }
  const totalOf = (item: string, hub: Hub) =>
    totals.get(`${item}:${hub}`) ?? { units: 0, value: 0 };

  const bestCross = new Map<string, Flip>();
  for (const c of candidatesOf(newest)) {
    const margin = marginIn(newest, c, settings);
    if (margin === null || margin <= 0) continue;
    const buyTotal = totalOf(c.item, c.buyHub);
    const sellTotal = totalOf(c.item, c.sellHub);
    if (Math.min(buyTotal.value, sellTotal.value) < settings.minLegValue) continue;

    const legs = newest.legs.get(c.item);
    const buy = legs?.get(c.buyHub);
    const sell = legs?.get(c.sellHub);
    if (!buy || !sell) continue;
    const quote = (hub: Hub, leg: Leg): FlipLeg => ({
      hub,
      avg: round(leg.avg),
      low: round(leg.low),
      high: round(leg.high),
      units24h: round(totalOf(c.item, hub).units),
      value24h: round(totalOf(c.item, hub).value),
    });
    let convert: Flip['convert'] = null;
    let bestMargin = margin;
    if (c.kind === 'cross') {
      const rate = conversion(newest, c.sellHub, c.buyHub);
      if (!rate) continue; // Not reached: marginIn already required the market.
      convert = { from: c.sellHub, to: c.buyHub, avg: round(rate.avg), best: round(rate.best) };
      bestMargin = (sell.high * rate.best) / buy.low - 1;
    }
    const flip: Flip = {
      id: keyOf(c),
      kind: c.kind,
      item: c.item,
      buy: quote(c.buyHub, buy),
      sell: quote(c.sellHub, sell),
      convert,
      margin: round(margin),
      bestMargin: round(bestMargin),
      units24h: round(Math.min(buyTotal.units, sellTotal.units)),
      value24h: round(Math.min(buyTotal.value, sellTotal.value)),
      hourly: views.map((view) => {
        const m = view && marginIn(view, c, settings);
        return m === null || m === undefined ? null : round(m);
      }),
    };
    if (c.kind === 'spread') {
      file.flips.push(flip);
    } else {
      const current = bestCross.get(c.item);
      if (!current || current.margin < flip.margin) bestCross.set(c.item, flip);
    }
  }
  file.flips.push(...bestCross.values());
  file.flips.sort((a, b) => b.margin - a.margin);
  return file;
}

/** Share (0–1) of the window's hours in which the flip made at least `minMargin`. */
export function recurrence(hourly: readonly (number | null)[], minMargin: number): number {
  if (hourly.length === 0) return 0;
  return hourly.filter((m) => m !== null && m >= minMargin).length / hourly.length;
}
