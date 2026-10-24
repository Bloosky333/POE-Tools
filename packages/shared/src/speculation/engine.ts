import { ECONOMY, type CoreCurrency, type Game } from '../games.ts';
import type { CurrentItem, HistoryPoint } from '../site-data.ts';
import { Series } from './series.ts';

/*
 * Suggestion engine of the Currency Speculation Advisor (spec 01, §4).
 * R(t) = reference-league price on league day t, N(t) = current-league price, d = today.
 */

export type SellMode = { kind: 'horizon'; days: number } | { kind: 'peak' } | { kind: 'end' };

export type Action = 'buy' | 'wait' | 'avoid' | 'neutral';

export interface EngineSettings {
  /** BUY NOW when the multiplier reaches this. */
  buyMultiplier: number;
  /** WAIT when the price is expected to dip by at least this fraction first. */
  dipThreshold: number;
  /** Minimum current daily volume (game unit) for BUY NOW and the market factor. */
  minVolume: number;
  /** Minimum price (game unit) of an item counted in the market factor. */
  minPrice: number;
  /** Daily volume (game unit) at which the liquidity part of confidence saturates. */
  liquiditySaturation: number;
  /** The unit currency, left out of the market factor. */
  unit: CoreCurrency;
  /** Days of history compared to judge trajectory similarity. */
  similarityWindow: number;
  /**
   * β in `premium^−β`: how much of an item's price premium over the market level of the
   * reference league is expected to fade by the sell day (0 = ignore, 1 = fully).
   */
  premiumDamping: number;
}

/** Default settings of a game: unit-free values are shared, the rest from its economy. */
export function engineSettingsFor(game: Game): EngineSettings {
  const economy = ECONOMY[game];
  return {
    buyMultiplier: 1.3,
    dipThreshold: 0.1,
    minVolume: economy.minVolume,
    minPrice: economy.minPrice,
    liquiditySaturation: economy.liquiditySaturation,
    unit: economy.unit,
    similarityWindow: 14,
    premiumDamping: 1,
  };
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = engineSettingsFor('poe2');

/** Items needed to estimate the market factor. */
const MARKET_MIN_ITEMS = 10;

export interface ConfidenceBreakdown {
  /** 0–1: how closely the current league follows the reference recently. */
  similarity: number;
  /** 0–1: trading volume in both leagues. */
  liquidity: number;
  /** 0–1: share of reference days with real data between today and the sell day. */
  completeness: number;
  /** 0.5 during launch days (0–3), 1 otherwise. */
  phase: number;
}

export interface Suggestion {
  item: CurrentItem;
  action: Action;
  /** Human-readable reasons, most important first. */
  reasons: string[];
  /** Null when the item has no usable reference data. */
  reference: {
    priceToday: number;
    buyDay: number;
    buyPrice: number;
    sellDay: number;
    sellPrice: number;
    /** R(sell) / R(today). */
    multiplier: number;
    /** R(sell) / R(buy): the gain when waiting for the dip. */
    multiplierFromBuy: number;
    /**
     * N(today) / (marketFactor × R(today)): the item's price relative to last league's on
     * the same day, after removing the market-wide difference. Null without market factor.
     */
    premium: number | null;
    /** premium^−β when premium > 1, else 1: the share of the reference rise still expected. */
    levelAdjustment: number;
    /** multiplierFromBuy × levelAdjustment: the gain this suggestion expects. */
    expectedMultiplier: number;
    /** Sell day had to be clipped to the end of the reference data. */
    clipped: boolean;
  } | null;
  /** Current price × expected multiplier. */
  projectedSellPrice: number | null;
  confidence: number;
  breakdown: ConfidenceBreakdown;
  /** Ranking score: (expected multiplier − 1) × confidence. */
  score: number;
}

export interface EngineInput {
  item: CurrentItem;
  /** Reference-league history of the item. */
  reference: readonly HistoryPoint[] | undefined;
  /** Current-league history of the item. */
  current: readonly HistoryPoint[] | undefined;
  /** Current league day (fractional allowed, floored for the reference). */
  today: number;
  mode: SellMode;
  /** Market-wide N/R price ratio today (see `marketFactor`); null/absent disables it. */
  marketFactor?: number | null;
  settings?: EngineSettings;
}

/**
 * Market-wide price level of the current league relative to the reference league on the
 * same day: median of N(today) / R(today) over liquid items. The unit's own value differs
 * between leagues, so an item at 2× last league's price is only expensive if the market
 * as a whole is not. Null when too few items can be compared.
 */
export function marketFactor(
  items: readonly CurrentItem[],
  referenceHistory: Readonly<Record<string, readonly HistoryPoint[]>>,
  today: number,
  settings: Pick<EngineSettings, 'minVolume' | 'minPrice' | 'unit'> = DEFAULT_ENGINE_SETTINGS,
): number | null {
  const d = Math.floor(today);
  const ratios: number[] = [];
  for (const item of items) {
    if (
      item.id === settings.unit ||
      item.price < settings.minPrice ||
      item.volume < settings.minVolume
    )
      continue;
    const history = referenceHistory[item.id];
    const ref = history && new Series(history).priceAt(d);
    if (ref) ratios.push(item.price / ref);
  }
  if (ratios.length < MARKET_MIN_ITEMS) return null;
  ratios.sort((a, b) => a - b);
  const mid = ratios.length >> 1;
  return ratios.length % 2
    ? (ratios[mid] ?? null)
    : ((ratios[mid - 1] ?? 0) + (ratios[mid] ?? 0)) / 2;
}

export function suggest(input: EngineInput): Suggestion {
  const settings = input.settings ?? DEFAULT_ENGINE_SETTINGS;
  const { item } = input;
  const d = Math.floor(input.today);
  const ref = new Series(input.reference ?? []);
  const cur = new Series(input.current ?? []);
  const phase = d <= 3 ? 0.5 : 1;

  const refToday = ref.priceAt(d);
  const lastDay = ref.lastDay;
  if (refToday === null || lastDay === null || lastDay <= d) {
    const breakdown = {
      similarity: 0,
      liquidity: liquidityScore(item.volume, null, settings.liquiditySaturation),
      completeness: 0,
      phase,
    };
    return {
      item,
      action: 'neutral',
      reasons: ['No reference data for this day'],
      reference: null,
      projectedSellPrice: null,
      confidence: 0,
      breakdown,
      score: 0,
    };
  }

  // Sell day.
  let sellDay: number;
  let clipped = false;
  if (input.mode.kind === 'horizon') {
    sellDay = d + input.mode.days;
    if (sellDay > lastDay) {
      sellDay = lastDay;
      clipped = true;
    }
  } else if (input.mode.kind === 'peak') {
    sellDay = argBest(ref, d + 1, lastDay, (a, b) => a > b) ?? lastDay;
  } else {
    sellDay = lastDay;
  }
  const sellPrice = ref.priceAt(sellDay) ?? refToday;

  // Buy day: lowest reference price between today and the sell day.
  const lowDay = argBest(ref, d, sellDay - 1, (a, b) => a < b) ?? d;
  const lowPrice = ref.priceAt(lowDay) ?? refToday;
  const dipAhead = lowPrice < refToday * (1 - settings.dipThreshold);
  const buyDay = dipAhead ? lowDay : d;
  const buyPrice = dipAhead ? lowPrice : refToday;

  const multiplier = sellPrice / refToday;
  const multiplierFromBuy = sellPrice / buyPrice;

  // Price level: a premium over last league's (market-adjusted) price is expected to fade,
  // eating into the reference rise. A discount is not expected to add to it (backtest).
  const factor = input.marketFactor ?? null;
  const premium = factor && factor > 0 ? item.price / (factor * refToday) : null;
  const levelAdjustment = premium !== null && premium > 1 ? premium ** -settings.premiumDamping : 1;
  const expectedMultiplier = multiplierFromBuy * levelAdjustment;

  // Confidence.
  const breakdown: ConfidenceBreakdown = {
    similarity: similarity(ref, cur, d, settings.similarityWindow),
    liquidity: liquidityScore(item.volume, ref.volumeAt(d), settings.liquiditySaturation),
    completeness: completeness(ref, d, sellDay),
    phase,
  };
  const confidence = Math.round(
    100 *
      breakdown.phase *
      (0.4 * breakdown.similarity + 0.35 * breakdown.liquidity + 0.25 * breakdown.completeness),
  );

  // Action.
  const liquid = item.volume >= settings.minVolume;
  const reasons: string[] = [];
  let action: Action;
  // AVOID stays on the raw reference curve: a premium alone did not predict losses.
  if (multiplierFromBuy < 1 || (!dipAhead && multiplier < 1)) {
    action = 'avoid';
    reasons.push(`Fell to ×${fmt(multiplier)} by day ${sellDay} last league`);
  } else if (dipAhead && expectedMultiplier >= settings.buyMultiplier) {
    action = 'wait';
    reasons.push(
      `Dipped ${Math.round((1 - lowPrice / refToday) * 100)}% until day ${lowDay} last league, then ×${fmt(multiplierFromBuy)}`,
    );
  } else if (!dipAhead && expectedMultiplier >= settings.buyMultiplier) {
    action = liquid ? 'buy' : 'neutral';
    reasons.push(`Rose ×${fmt(multiplier)} by day ${sellDay} last league`);
    if (!liquid) reasons.push(`Low volume (${fmt(item.volume)} div/day)`);
  } else {
    action = 'neutral';
    reasons.push(
      `×${fmt(dipAhead ? multiplierFromBuy : multiplier)} by day ${sellDay} last league`,
    );
  }
  if (premium !== null && levelAdjustment < 1) {
    reasons.push(
      `Already ${fmt(item.price / refToday)}× last league's day-${d} price (market ${fmt(factor ?? 0)}×): ` +
        `${Math.round((premium - 1) * 100)}% premium, expecting ×${fmt(expectedMultiplier)}`,
    );
  }
  if (clipped) reasons.push('Reference league data ends before the sell day');
  if (breakdown.similarity < 0.3) reasons.push('This league is not following the reference curve');
  if (phase < 1) reasons.push('League launch: prices are volatile');

  return {
    item,
    action,
    reasons,
    reference: {
      priceToday: refToday,
      buyDay,
      buyPrice,
      sellDay,
      sellPrice,
      multiplier,
      multiplierFromBuy,
      premium,
      levelAdjustment,
      expectedMultiplier,
      clipped,
    },
    projectedSellPrice: item.price * expectedMultiplier,
    confidence,
    breakdown,
    score: (expectedMultiplier - 1) * (confidence / 100),
  };
}

/** Day in [from, to] whose interpolated price is best according to `better`. */
export function argBest(
  series: Series,
  from: number,
  to: number,
  better: (a: number, b: number) => boolean,
): number | null {
  let bestDay: number | null = null;
  let bestPrice = 0;
  for (let day = from; day <= to; day++) {
    const price = series.priceAt(day);
    if (price === null) continue;
    if (bestDay === null || better(price, bestPrice)) {
      bestDay = day;
      bestPrice = price;
    }
  }
  return bestDay;
}

/**
 * Pearson correlation of daily log-returns of both leagues over the last `window` days,
 * mapped to 0–1 (0.5 when there isn't enough data to judge).
 */
export function similarity(ref: Series, cur: Series, d: number, window: number): number {
  const refReturns: number[] = [];
  const curReturns: number[] = [];
  for (let day = d - window + 1; day <= d; day++) {
    const r0 = ref.priceAt(day - 1);
    const r1 = ref.priceAt(day);
    const c0 = cur.priceAt(day - 1);
    const c1 = cur.priceAt(day);
    if (r0 && r1 && c0 && c1) {
      refReturns.push(Math.log(r1 / r0));
      curReturns.push(Math.log(c1 / c0));
    }
  }
  if (refReturns.length < 5) return 0.5;
  const corr = pearson(refReturns, curReturns);
  return corr === null ? 0.5 : (corr + 1) / 2;
}

function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma;
    const db = (b[i] ?? 0) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : null;
}

/** 0–1, saturating at `saturation` per day (PoE 2: 50 div) in both leagues. */
export function liquidityScore(
  currentVolume: number,
  referenceVolume: number | null,
  saturation = DEFAULT_ENGINE_SETTINGS.liquiditySaturation,
): number {
  const score = (v: number) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + saturation));
  return referenceVolume === null
    ? score(currentVolume)
    : (score(currentVolume) + score(referenceVolume)) / 2;
}

export function completeness(ref: Series, from: number, to: number): number {
  if (to <= from) return 1;
  let known = 0;
  for (let day = from; day <= to; day++) if (ref.has(day)) known++;
  return known / (to - from + 1);
}

function fmt(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
}
