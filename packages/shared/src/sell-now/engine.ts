import type { CurrentItem, HistoryPoint } from '../site-data.ts';
import {
  argBest,
  completeness,
  liquidityScore,
  similarity,
  type ConfidenceBreakdown,
} from '../speculation/engine.ts';
import { Series } from '../speculation/series.ts';

/*
 * Sell Now engine (spec 06): flags items to sell because last league's curve peaks here
 * and then declines, or because the price is falling fast right now.
 * R(t) = reference-league price on league day t, N(t) = current-league price, d = today.
 */

export type SellVerdict = 'sell-now' | 'sell-soon' | 'hold';

/** Why an item is flagged: the reference peaks around today, or it is falling now. */
export type SellReason = 'peak' | 'falling';

export interface SellSettings {
  /** Days after today (or after the upcoming peak) used to judge the reference decline. */
  horizon: number;
  /** Peak signal when the reference fell at least this fraction over `horizon` days. */
  peakDrop: number;
  /** SELL SOON when the reference still peaks within this many days. */
  soonWindow: number;
  /** An upcoming reference peak must be at least this much above today's price. */
  peakMargin: number;
  /**
   * Falling when the price dropped at least this fraction over 7 days and the reference
   * did not rise over the next `horizon` days (short drops alone mostly rebound: backtest).
   */
  fallDrop: number;
  /** Measure the 7-day drop relative to the market (median of liquid items). */
  marketAdjustFalling: boolean;
  /** Days of history compared to judge trajectory similarity. */
  similarityWindow: number;
}

export const DEFAULT_SELL_SETTINGS: SellSettings = {
  horizon: 14,
  peakDrop: 0.15,
  soonWindow: 7,
  peakMargin: 0.03,
  fallDrop: 0.15,
  marketAdjustFalling: false,
  similarityWindow: 14,
};

/** Price change windows (days) reported and checked for the falling signal. */
export const SELL_WINDOWS = [1, 3, 7] as const;
export type SellWindow = (typeof SELL_WINDOWS)[number];

/** Change ratios of a price over each window (N(d) / N(d − k) − 1), null when unknown. */
export type WindowChanges = Record<SellWindow, number | null>;

export interface SellSignal {
  item: CurrentItem;
  verdict: SellVerdict;
  /** Signals that fired (empty for HOLD unless a peak is coming). */
  signals: SellReason[];
  /** Human-readable reasons, most important first. */
  reasons: string[];
  /** Raw price changes over 1 / 3 / 7 days. */
  change: WindowChanges;
  /** Price changes relative to the market over 1 / 3 / 7 days. */
  adjustedChange: WindowChanges;
  /** N(today) / highest price of this league so far. */
  fromHigh: number | null;
  /** Null when the item has no usable reference data. */
  reference: {
    priceToday: number;
    /** Highest reference price in [today, today + soonWindow]. */
    peakDay: number;
    peakPrice: number;
    /** Day the decline is measured to: peak (or today) + horizon, clipped. */
    horizonDay: number;
    horizonPrice: number;
    /** R(horizonDay) / R(peakDay): the reference move after the peak. */
    change: number;
    clipped: boolean;
  } | null;
  /** League day to sell on for SELL SOON (the reference peak), else today. */
  sellDay: number | null;
  /** Expected fractional loss if held (0 = none). */
  expectedLoss: number;
  confidence: number;
  breakdown: ConfidenceBreakdown;
  /** Ranking score: expected loss × confidence. */
  score: number;
}

export interface SellInput {
  item: CurrentItem;
  reference: readonly HistoryPoint[] | undefined;
  current: readonly HistoryPoint[] | undefined;
  /** Current league day (fractional allowed, floored). */
  today: number;
  /** Market change ratios (see `marketChanges`); absent = no market adjustment. */
  market?: WindowChanges | undefined;
  settings?: SellSettings;
}

/** Minimum price (div) and volume of an item counted in the market move. */
const MARKET_MIN_PRICE = 0.05;
const MARKET_MIN_VOLUME = 5;
const MARKET_MIN_ITEMS = 10;

/** Price changes of an item over each window, from its current price and history. */
export function windowChanges(price: number, history: Series, d: number): WindowChanges {
  const at = (k: SellWindow) => {
    const past = history.priceAt(d - k);
    return past ? price / past - 1 : null;
  };
  return { 1: at(1), 3: at(3), 7: at(7) };
}

/**
 * Market move over each window: median change of liquid items. A move of divine itself
 * shifts every item priced in divine, so items are judged against this. Null per window
 * when too few items can be compared.
 */
export function marketChanges(
  items: readonly CurrentItem[],
  currentHistory: Readonly<Record<string, readonly HistoryPoint[]>>,
  today: number,
): WindowChanges {
  const d = Math.floor(today);
  const changes: Record<SellWindow, number[]> = { 1: [], 3: [], 7: [] };
  for (const item of items) {
    if (item.id === 'divine' || item.price < MARKET_MIN_PRICE || item.volume < MARKET_MIN_VOLUME)
      continue;
    const history = currentHistory[item.id];
    if (!history) continue;
    const c = windowChanges(item.price, new Series(history), d);
    for (const k of SELL_WINDOWS) {
      const value = c[k];
      if (value !== null) changes[k].push(value);
    }
  }
  const median = (values: number[]) => {
    if (values.length < MARKET_MIN_ITEMS) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2
      ? (sorted[mid] ?? null)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  };
  return { 1: median(changes[1]), 3: median(changes[3]), 7: median(changes[7]) };
}

export function sellSignal(input: SellInput): SellSignal {
  const settings = input.settings ?? DEFAULT_SELL_SETTINGS;
  const { item } = input;
  const d = Math.floor(input.today);
  const ref = new Series(input.reference ?? []);
  const cur = new Series(input.current ?? []);
  const phase = d <= 3 ? 0.5 : 1;

  // Momentum, raw and relative to the market.
  const change = windowChanges(item.price, cur, d);
  const adjustedChange = {} as WindowChanges;
  for (const k of SELL_WINDOWS) {
    const own = change[k];
    const market = input.market?.[k] ?? null;
    adjustedChange[k] = own === null ? null : market === null ? own : (1 + own) / (1 + market) - 1;
  }
  const high = Math.max(item.price, ...cur.between(0, d).map((p) => p[1]));
  const fromHigh = high > 0 ? item.price / high : null;

  // Reference: is there a peak around today followed by a decline?
  const refToday = ref.priceAt(d);
  const lastDay = ref.lastDay;
  let reference: SellSignal['reference'] = null;
  let refOutlook: number | null = null;
  let peakNow = false;
  let peakAhead = false;
  if (refToday !== null && lastDay !== null && lastDay > d) {
    const windowEnd = Math.min(d + settings.soonWindow, lastDay);
    let peakDay = argBest(ref, d, windowEnd, (a, b) => a > b) ?? d;
    let peakPrice = ref.priceAt(peakDay) ?? refToday;
    if (peakPrice < refToday * (1 + settings.peakMargin)) {
      peakDay = d;
      peakPrice = refToday;
    }
    let horizonDay = peakDay + settings.horizon;
    const clipped = horizonDay > lastDay;
    if (clipped) horizonDay = lastDay;
    const horizonPrice = ref.priceAt(horizonDay) ?? peakPrice;
    const refChange = horizonPrice / peakPrice;
    reference = {
      priceToday: refToday,
      peakDay,
      peakPrice,
      horizonDay,
      horizonPrice,
      change: refChange,
      clipped,
    };
    refOutlook = (ref.priceAt(Math.min(d + settings.horizon, lastDay)) ?? refToday) / refToday;
    const declines = refChange <= 1 - settings.peakDrop;
    peakAhead = declines && peakDay > d;
    peakNow = declines && peakDay === d;
  }

  // Falling over a week while last league did not recover over the horizon.
  const week = (settings.marketAdjustFalling ? adjustedChange : change)[7];
  const falling =
    week !== null && week <= -settings.fallDrop && refOutlook !== null && refOutlook <= 1;

  const signals: SellReason[] = [];
  const reasons: string[] = [];
  let verdict: SellVerdict = 'hold';
  if (falling) {
    verdict = 'sell-now';
    signals.push('falling');
    reasons.push(
      `Falling: ${pct(week)} in 7 days${settings.marketAdjustFalling ? ' vs the market' : ''}, ` +
        `and last league did not recover (${pct((refOutlook ?? 1) - 1)} over ${settings.horizon} days)`,
    );
  }
  if (reference && (peakNow || peakAhead)) {
    signals.push('peak');
    const drop = `then fell ${pct(reference.change - 1)} by day ${reference.horizonDay}`;
    if (peakAhead) {
      if (verdict === 'hold') verdict = 'sell-soon';
      reasons.push(
        `Last league peaked on day ${reference.peakDay} (${pct(reference.peakPrice / reference.priceToday - 1)} from today), ${drop}`,
      );
    } else {
      verdict = 'sell-now';
      reasons.push(`Last league peaked around day ${d}, ${drop}`);
    }
  }
  const sellDay =
    verdict === 'sell-now' ? d : verdict === 'sell-soon' ? (reference?.peakDay ?? d) : null;
  if (verdict === 'hold') reasons.push('No sell signal');
  const rise = adjustedChange[3];
  if (verdict !== 'hold' && rise !== null && rise >= 0.1)
    reasons.push(`Still rising (${pct(rise)} in 3 days vs the market)`);
  if (fromHigh !== null && fromHigh >= 0.95 && verdict !== 'hold')
    reasons.push('At its highest price of this league');

  // Expected loss if held, from last league's curve.
  const expectedLoss =
    verdict === 'hold'
      ? 0
      : Math.max(
          0,
          signals.includes('peak') && reference ? 1 - reference.change : 0,
          refOutlook === null ? 0 : 1 - refOutlook,
        );

  // Confidence: as in the speculation engine; momentum-only calls use current data.
  const hasRef = reference !== null;
  const breakdown: ConfidenceBreakdown = {
    similarity: hasRef ? similarity(ref, cur, d, settings.similarityWindow) : 0.5,
    liquidity: liquidityScore(item.volume, hasRef ? ref.volumeAt(d) : null),
    completeness: hasRef
      ? completeness(ref, d, reference?.horizonDay ?? d)
      : completeness(cur, d - 7, d - 1),
    phase,
  };
  const confidence = Math.round(
    100 *
      breakdown.phase *
      (0.4 * breakdown.similarity + 0.35 * breakdown.liquidity + 0.25 * breakdown.completeness),
  );

  if (!hasRef) reasons.push('No reference data for this day');
  else if (reference?.clipped) reasons.push('Reference league data ends before the horizon');
  if (hasRef && breakdown.similarity < 0.3 && signals.includes('peak'))
    reasons.push('This league is not following the reference curve');
  if (phase < 1) reasons.push('League launch: prices are volatile');

  return {
    item,
    verdict,
    signals,
    reasons,
    change,
    adjustedChange,
    fromHigh,
    reference,
    sellDay,
    expectedLoss,
    confidence,
    breakdown,
    score: expectedLoss * (confidence / 100),
  };
}

function pct(value: number | null): string {
  if (value === null) return '–';
  const p = Math.round(value * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
}
