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
  /** Minimum current daily volume (div) for BUY NOW. */
  minVolume: number;
  /** Days of history compared to judge trajectory similarity. */
  similarityWindow: number;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  buyMultiplier: 1.3,
  dipThreshold: 0.1,
  minVolume: 5,
  similarityWindow: 14,
};

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
    /** Sell day had to be clipped to the end of the reference data. */
    clipped: boolean;
  } | null;
  /** Current price × multiplier from the buy day. */
  projectedSellPrice: number | null;
  confidence: number;
  breakdown: ConfidenceBreakdown;
  /** Ranking score: (multiplier − 1) × confidence. */
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
  settings?: EngineSettings;
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
      liquidity: liquidityScore(item.volume, null),
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

  // Confidence.
  const breakdown: ConfidenceBreakdown = {
    similarity: similarity(ref, cur, d, settings.similarityWindow),
    liquidity: liquidityScore(item.volume, ref.volumeAt(d)),
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
  if (multiplierFromBuy < 1 || (!dipAhead && multiplier < 1)) {
    action = 'avoid';
    reasons.push(`Fell to ×${fmt(multiplier)} by day ${sellDay} last league`);
  } else if (dipAhead && multiplierFromBuy >= settings.buyMultiplier) {
    action = 'wait';
    reasons.push(
      `Dipped ${Math.round((1 - lowPrice / refToday) * 100)}% until day ${lowDay} last league, then ×${fmt(multiplierFromBuy)}`,
    );
  } else if (!dipAhead && multiplier >= settings.buyMultiplier) {
    action = liquid ? 'buy' : 'neutral';
    reasons.push(`Rose ×${fmt(multiplier)} by day ${sellDay} last league`);
    if (!liquid) reasons.push(`Low volume (${fmt(item.volume)} div/day)`);
  } else {
    action = 'neutral';
    reasons.push(
      `×${fmt(dipAhead ? multiplierFromBuy : multiplier)} by day ${sellDay} last league`,
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
      clipped,
    },
    projectedSellPrice: item.price * multiplierFromBuy,
    confidence,
    breakdown,
    score: (multiplierFromBuy - 1) * (confidence / 100),
  };
}

/** Day in [from, to] whose interpolated price is best according to `better`. */
function argBest(
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

/** 0–1, saturating at 50 div/day in both leagues. */
function liquidityScore(currentVolume: number, referenceVolume: number | null): number {
  const score = (v: number) => Math.min(1, Math.log10(1 + v) / Math.log10(51));
  return referenceVolume === null
    ? score(currentVolume)
    : (score(currentVolume) + score(referenceVolume)) / 2;
}

function completeness(ref: Series, from: number, to: number): number {
  if (to <= from) return 1;
  let known = 0;
  for (let day = from; day <= to; day++) if (ref.has(day)) known++;
  return known / (to - from + 1);
}

function fmt(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
}
