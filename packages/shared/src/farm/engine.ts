import { ECONOMY, type CoreCurrency, type Game } from '../games.ts';
import type { CurrentItem, HistoryPoint } from '../site-data.ts';
import { marketChanges } from '../sell-now/engine.ts';
import { liquidityScore, similarity, type ConfidenceBreakdown } from '../speculation/engine.ts';
import { confidenceOf, formatPct as pct, launchPhase, median } from '../scoring.ts';
import { Series } from '../speculation/series.ts';
import { farmRole } from './mechanics.ts';
import { formatDays } from '../time.ts';

/*
 * What to Farm engine (spec 09): groups liquid exchange items by league mechanic and judges
 * each mechanic's loot by its size, value, 7-day trend and last league's 14-day outlook.
 * R(t) = reference-league price on league day t, N(t) = current-league price, d = today.
 */

export type FarmVerdict = 'farm-hold' | 'farm-sell' | 'thin' | 'avoid';

/** First league day with verdicts: the 7-day trend needs a week of this league. */
export const FARM_START_DAY = 7;

export interface FarmSettings {
  /** Days ahead of today the outlook looks at in the reference league. */
  horizon: number;
  /** FARM & HOLD when the outlook vs the market is at least 1 + this. */
  holdRise: number;
  /** AVOID when the outlook vs the market is at most 1 − this… */
  avoidDrop: number;
  /**
   * …or when the 7-day trend vs the market is at most 1 − this and the outlook ≤ 1. Null =
   * off (default: in the backtest these mechanics rebounded, spec 09 §6).
   */
  fallDrop: number | null;
  /** Max share of a mechanic's weight one item may have. */
  weightCap: number;
  /** FARM & SELL needs at least this much traded per day (game unit); else THIN. */
  minMarket: number;
  /** Daily mechanic volume (game unit) at which the liquidity part of confidence saturates. */
  liquiditySaturation: number;
  /** Days of history compared to judge how the index follows last league. */
  similarityWindow: number;
}

/** Default settings of a game: thresholds are shared, volumes from its economy. */
export function farmSettingsFor(game: Game): FarmSettings {
  const economy = ECONOMY[game];
  return {
    horizon: 14,
    holdRise: 0.15,
    avoidDrop: 0.15,
    fallDrop: null,
    weightCap: 0.4,
    // 50 div/day in PoE 2; the same multiple of the item saturation in PoE 1.
    minMarket: economy.liquiditySaturation,
    liquiditySaturation: economy.liquiditySaturation * 5,
    similarityWindow: 14,
  };
}

/** Which items are counted: liquid items other than the unit. */
export interface FarmScope {
  unit: CoreCurrency;
  minPrice: number;
  minVolume: number;
}

/** One item of a mechanic, with its part in the index. */
export interface FarmItem {
  item: CurrentItem;
  /** Share of the mechanic's (capped) weight, 0–1. */
  share: number;
  /** N(d) / N(d − 7) vs the market's median 7-day move; null when unknown. */
  trend: number | null;
  /** R(d + h) / R(d) vs the reference market's median move; null without reference data. */
  outlook: number | null;
}

export interface FarmSignal {
  /** Mechanic name, or null for the "Any content" baseline row. */
  mechanic: string | null;
  /** Null for the baseline row. */
  verdict: FarmVerdict | null;
  /** Human-readable reasons, most important first. */
  reasons: string[];
  /** Liquid items, by weight (largest first). */
  items: FarmItem[];
  /** Traded per day over its liquid items (game unit). */
  marketSize: number;
  /** Average price of a unit of its loot traded (game unit). */
  lootValue: number;
  /** Weighted 7-day move vs the market (ratio, 1 = like the market); null when unknown. */
  trend: number | null;
  /** Weighted reference move over the horizon vs the reference market; null without data. */
  outlook: number | null;
  /** Day the outlook is measured to (d + horizon, clipped to the reference's last day). */
  outlookDay: number | null;
  /** Index of this league up to today and of last league around today (1 = today). */
  index: { current: HistoryPoint[]; reference: HistoryPoint[] };
  confidence: number;
  breakdown: ConfidenceBreakdown;
  /** Ranking within a verdict: (outlook − 1) × confidence, 0 without an outlook. */
  score: number;
}

export interface FarmInput {
  game: Game;
  items: readonly CurrentItem[];
  currentHistory: Readonly<Record<string, readonly HistoryPoint[]>>;
  referenceHistory: Readonly<Record<string, readonly HistoryPoint[]>>;
  /** Current league day (fractional allowed, floored). */
  today: number;
  /** Items counted (default: the game's liquidity thresholds). */
  scope?: FarmScope | undefined;
  settings?: FarmSettings | undefined;
}

/** Days of index shown before today (both leagues) and after it (reference). */
const INDEX_BACK = 30;
const INDEX_AHEAD = 30;

interface Member {
  item: CurrentItem;
  cur: Series;
  ref: Series;
  weight: number;
}

/** One signal per mechanic plus the "Any content" baseline (mechanic null). */
export function farmSignals(input: FarmInput): FarmSignal[] {
  const settings = input.settings ?? farmSettingsFor(input.game);
  const scope = input.scope ?? ECONOMY[input.game];
  const d = Math.floor(input.today);
  const liquid = input.items.filter(
    (i) => i.id !== scope.unit && i.price >= scope.minPrice && i.volume >= scope.minVolume,
  );

  // Market moves: this league's median 7-day change, last league's median over the horizon.
  const market7 = marketChanges(input.items, input.currentHistory, d, scope)[7];
  const refMarket = referenceMarket(input, scope, d, settings.horizon);

  const groups = new Map<string | null, CurrentItem[]>();
  for (const item of liquid) {
    const role = farmRole(input.game, item);
    if (role.kind === 'input' || role.kind === 'ignored') continue;
    const key = role.kind === 'any' ? null : role.mechanic;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups].map(([mechanic, items]) =>
    signalOf(mechanic, items, input, settings, d, market7, refMarket),
  );
}

function signalOf(
  mechanic: string | null,
  items: readonly CurrentItem[],
  input: FarmInput,
  settings: FarmSettings,
  d: number,
  market7: number | null,
  refMarket: { change: number | null; lastDay: number | null },
): FarmSignal {
  // Weights: 7-day average daily volume, capped so one item cannot be the whole index.
  const raw = items
    .map((item) => {
      const cur = new Series(input.currentHistory[item.id] ?? []);
      const volumes = [item.volume, ...cur.between(d - 6, d - 1).map((p) => p[2])];
      return {
        item,
        cur,
        ref: new Series(input.referenceHistory[item.id] ?? []),
        weight: volumes.reduce((s, v) => s + v, 0) / volumes.length,
      };
    })
    .sort((a, b) => b.weight - a.weight);
  const shares = cappedShares(
    raw.map((m) => m.weight),
    settings.weightCap,
  );
  const members: Member[] = raw.map((m, i) => ({ ...m, weight: shares[i] ?? 0 }));
  const marketSize = items.reduce((s, i) => s + i.volume, 0);
  // Average price of a unit traded: volume is in the game's unit, so units = volume / price.
  const unitsTraded = items.reduce((s, i) => s + i.volume / i.price, 0);
  const lootValue = unitsTraded ? marketSize / unitsTraded : 0;

  const horizonDay = d + settings.horizon;
  const outlookDay =
    refMarket.lastDay === null || refMarket.lastDay <= d
      ? null
      : Math.min(horizonDay, refMarket.lastDay);

  // Both are "vs the market": unknown when the market's own move is (too few items).
  const memberTrend = (m: Member) => {
    const past = m.cur.priceAt(d - 7);
    if (!past || market7 === null) return null;
    return m.item.price / past / (1 + market7);
  };
  const memberOutlook = (m: Member) => {
    if (outlookDay === null || refMarket.change === null) return null;
    const now = m.ref.priceAt(d);
    const later = m.ref.priceAt(outlookDay);
    if (!now || !later) return null;
    return later / now / refMarket.change;
  };
  const farmItems: FarmItem[] = members.map((m) => ({
    item: m.item,
    share: m.weight,
    trend: memberTrend(m),
    outlook: memberOutlook(m),
  }));

  const weighted = (pick: (f: FarmItem) => number | null) => {
    let sum = 0;
    let w = 0;
    for (const f of farmItems) {
      const value = pick(f);
      if (value === null) continue;
      sum += f.share * value;
      w += f.share;
    }
    return { value: w ? sum / w : null };
  };
  const trend = weighted((f) => f.trend).value;
  const outlook = weighted((f) => f.outlook).value;
  const rawTotal = raw.reduce((s, m) => s + m.weight, 0);
  const withReference = raw.reduce(
    (s, m, i) => s + ((farmItems[i]?.outlook ?? null) !== null ? m.weight : 0),
    0,
  );

  const index = {
    current: indexSeries(
      members,
      (m) => m.cur,
      (m) => m.item.price,
      d,
      d - INDEX_BACK,
      d - 1,
    ),
    reference: indexSeries(
      members,
      (m) => m.ref,
      (m) => m.ref.priceAt(d),
      d,
      d - INDEX_BACK,
      Math.min(d + INDEX_AHEAD, refMarket.lastDay ?? d),
    ),
  };

  // Confidence (spec 01 §4.4) applied to the mechanic's index.
  const refVolume = members.reduce((s, m) => s + (m.ref.volumeAt(d) ?? 0), 0);
  const breakdown: ConfidenceBreakdown = {
    similarity: similarity(
      new Series(index.reference),
      new Series(index.current),
      d,
      settings.similarityWindow,
    ),
    liquidity: liquidityScore(
      marketSize,
      outlook === null ? null : refVolume,
      settings.liquiditySaturation,
    ),
    // Share of the mechanic's (uncapped) volume with reference history over the outlook.
    completeness: rawTotal ? withReference / rawTotal : 0,
    phase: launchPhase(d),
  };
  const confidence = confidenceOf(breakdown);

  // Verdict.
  const reasons: string[] = [];
  let verdict: FarmVerdict | null = null;
  if (mechanic !== null) {
    const falling =
      settings.fallDrop !== null &&
      trend !== null &&
      trend <= 1 - settings.fallDrop &&
      outlook !== null &&
      outlook <= 1;
    if (outlook !== null && outlook <= 1 - settings.avoidDrop) {
      verdict = 'avoid';
      reasons.push(
        `Last league its loot fell ${pct(outlook - 1)} vs the market over the next ${formatDays((outlookDay ?? d) - d)}`,
      );
    } else if (falling) {
      verdict = 'avoid';
      reasons.push(
        `Falling: ${pct(trend - 1)} in 7 days vs the market, and last league did not recover (${pct(outlook - 1)})`,
      );
    } else if (outlook !== null && outlook >= 1 + settings.holdRise) {
      verdict = 'farm-hold';
      reasons.push(
        `Last league its loot rose ${pct(outlook - 1)} vs the market over the next ${formatDays((outlookDay ?? d) - d)}: farm now, sell later`,
      );
    } else if (marketSize >= settings.minMarket) {
      verdict = 'farm-sell';
      reasons.push('Loot sells well and holds its value: sell as you go');
    } else {
      verdict = 'thin';
      reasons.push('Little of its loot trades: hard to sell much');
    }
  } else {
    reasons.push('Loot that drops in any content, to compare mechanics against');
  }
  if (trend !== null && Math.abs(trend - 1) >= 0.1 && verdict !== 'avoid')
    reasons.push(`${pct(trend - 1)} over 7 days vs the market`);
  const top = raw[0];
  if (top && raw.length > 1 && top.weight > settings.weightCap * rawTotal)
    reasons.push(
      `${top.item.name} trades ${Math.round((top.weight / rawTotal) * 100)} % of its volume (weight capped)`,
    );
  if (outlookDay !== null && refMarket.change === null)
    reasons.push("Too few items to measure last league's market move: no outlook");
  else if (outlook === null) reasons.push('No reference data for this day');
  if (market7 === null) reasons.push("Too few items to measure this league's 7-day market move");
  else if (outlookDay !== null && outlookDay < horizonDay)
    reasons.push('Reference league data ends before the horizon');
  if (outlook !== null && breakdown.similarity < 0.3)
    reasons.push('This league is not following the reference curve');

  return {
    mechanic,
    verdict,
    reasons,
    items: farmItems,
    marketSize,
    lootValue,
    trend,
    outlook,
    outlookDay: outlook === null ? null : outlookDay,
    index,
    confidence,
    breakdown,
    score: ((outlook ?? 1) - 1) * (confidence / 100),
  };
}

/**
 * Shares of `weights` (sorted largest first) where no item exceeds `cap`: the largest items
 * are set to `cap` and the rest share what is left in proportion. Equal shares when fewer
 * than 1 / cap items make the cap impossible.
 */
export function cappedShares(weights: readonly number[], cap: number): number[] {
  const n = weights.length;
  if (!n) return [];
  if (n * cap < 1) return weights.map(() => 1 / n);
  for (let k = 0; k < n; k++) {
    const rest = weights.slice(k).reduce((s, w) => s + w, 0);
    const left = 1 - k * cap;
    const next = rest ? ((weights[k] ?? 0) / rest) * left : left / (n - k);
    if (next <= cap + 1e-12)
      return weights.map((w, i) => (i < k ? cap : rest ? (w / rest) * left : left / (n - k)));
  }
  return weights.map(() => 1 / n);
}

/**
 * Weighted index Σ w × P(t) / P(d) / Σ w over the items priced on both days, for each day of
 * `[from, to]` (and 1 on today), so both leagues read as "change from today".
 */
function indexSeries(
  members: readonly Member[],
  series: (m: Member) => Series,
  base: (m: Member) => number | null,
  d: number,
  from: number,
  to: number,
): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (let day = Math.max(0, from); day <= to; day++) {
    if (day === d) {
      points.push([d, 1, 0]);
      continue;
    }
    let sum = 0;
    let w = 0;
    for (const m of members) {
      const b = base(m);
      const p = series(m).priceAt(day);
      if (!b || !p) continue;
      sum += m.weight * (p / b);
      w += m.weight;
    }
    if (w) points.push([day, sum / w, 0]);
  }
  if (!points.some((p) => p[0] === d) && d >= from) points.push([d, 1, 0]);
  return points.sort((a, b) => a[0] - b[0]);
}

/** Median reference move over the horizon of items liquid in the reference league today. */
function referenceMarket(
  input: FarmInput,
  scope: FarmScope,
  d: number,
  horizon: number,
): { change: number | null; lastDay: number | null } {
  let lastDay: number | null = null;
  const series = new Map<string, Series>();
  for (const [id, points] of Object.entries(input.referenceHistory)) {
    const s = new Series(points);
    series.set(id, s);
    if (s.lastDay !== null && (lastDay === null || s.lastDay > lastDay)) lastDay = s.lastDay;
  }
  if (lastDay === null || lastDay <= d) return { change: null, lastDay };
  const to = Math.min(d + horizon, lastDay);
  const ratios: number[] = [];
  for (const [id, s] of series) {
    if (id === scope.unit) continue;
    const now = s.priceAt(d);
    const later = s.priceAt(to);
    const volume = s.volumeAt(d);
    if (!now || !later || now < scope.minPrice || (volume ?? 0) < scope.minVolume) continue;
    ratios.push(later / now);
  }
  return { change: median(ratios), lastDay };
}
