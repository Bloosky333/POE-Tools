import { ECONOMY, type CoreCurrency, type Game } from '../games.ts';
import type { PairQuote, PayCurrency } from '../site-data.ts';

/*
 * Buy With / Sell For (spec 04-buy-with-sell-for): an exchange item trades in one market per
 * hub currency, at rates that disagree. For N units of an item, compare buying it with (or
 * selling it for) each hub currency directly, in whole units, and recommend one only when it
 * is meaningfully better on a pair that actually trades.
 */

/** Buying the item (pay currency) or selling it (receive currency). */
export type PairSide = 'buy' | 'sell';

export interface BestPairSettings {
  /** Recommend only when the next pair is this much worse (0.05 = 5 %). */
  minEdge: number;
  /** ... and the recommended pair traded at least this per day (game unit). */
  minPairVolume: number;
}

export function bestPairSettingsFor(game: Game): BestPairSettings {
  return { minEdge: 0.05, minPairVolume: ECONOMY[game].pairMinVolume };
}

export interface PairOption {
  currency: PayCurrency;
  quote: PairQuote;
  /**
   * Whole units of `currency` that change hands: handed over when buying (rounded up),
   * received when selling (rounded down, 0 when the quantity is worth less than one unit).
   */
  amount: number;
  /** Units lost to whole-unit rounding: paid beyond the exact price / not received. */
  rounding: number;
  /** Real value of `amount` in the game's unit: cost when buying, proceeds when selling. */
  value: number;
  /** `value` per item. */
  unitValue: number;
  /**
   * Items worth the same `amount` at this rate. Buying: as many as it buys (≥ the
   * quantity). Selling: as few as it takes (≤ the quantity; when `amount` is 0, the
   * quantity needed to receive one whole unit).
   */
  cleanQuantity: number;
}

export type NoVerdictReason =
  | 'single-pair'
  | 'small-difference'
  | 'low-volume'
  | 'unknown-volume'
  /** Selling: the quantity is worth less than one whole unit of every currency. */
  | 'too-few';

export interface BestPairResult {
  side: PairSide;
  /** Options sorted from best to worst (cheapest when buying, highest proceeds when selling). */
  options: PairOption[];
  verdict: {
    currency: PayCurrency;
    /**
     * How much worse the next and the worst options are (0.1 = 10 %): buying, how much
     * cheaper the best is than them; selling, how much less they pay than the best.
     */
    edgeVsNext: number;
    edgeVsWorst: number;
  } | null;
  /** Why there is no verdict (null when there is one or no option at all). */
  reason: NoVerdictReason | null;
}

export interface BestPairInput {
  side: PairSide;
  quotes: Partial<Record<PayCurrency, PairQuote>>;
  quantity: number;
  /** Game unit of values. */
  unit: CoreCurrency;
  /** Units of each other currency per 1 `unit` (`current.json` rates). */
  rates: Partial<Record<CoreCurrency, number>>;
  /** Currencies the item trades against (the game's hubs). */
  currencies: readonly PayCurrency[];
  settings: BestPairSettings;
}

/** Tolerance on whole-unit rounding (rates are rounded to 6 significant digits). */
const EPSILON = 1e-9;

export function bestPair(input: BestPairInput): BestPairResult {
  const { side } = input;
  const quantity = Math.max(1, Math.floor(input.quantity));
  const options: PairOption[] = [];
  for (const currency of input.currencies) {
    const quote = input.quotes[currency];
    const perUnit = currency === input.unit ? 1 : input.rates[currency];
    if (!quote || !(quote.rate > 0) || !perUnit) continue;
    const exact = quantity * quote.rate;
    const amount =
      side === 'buy'
        ? Math.max(1, Math.ceil(exact - EPSILON * exact))
        : Math.floor(exact + EPSILON * exact);
    const value = amount / perUnit;
    options.push({
      currency,
      quote,
      amount,
      rounding: Math.abs(amount - exact),
      value,
      unitValue: value / quantity,
      cleanQuantity:
        side === 'buy'
          ? Math.max(quantity, Math.floor(amount / quote.rate + EPSILON))
          : Math.ceil(Math.max(1, amount) / quote.rate - EPSILON),
    });
  }
  options.sort((a, b) => (side === 'buy' ? a.value - b.value : b.value - a.value));

  const [best, next] = options;
  const worst = options.at(-1);
  if (!best) return { side, options, verdict: null, reason: null };
  if (best.amount === 0) return { side, options, verdict: null, reason: 'too-few' };
  if (!next || !worst) return { side, options, verdict: null, reason: 'single-pair' };
  // Buying: 1 − best/other (best is X % cheaper). Selling: 1 − other/best (other pays X % less).
  const edge = (other: PairOption) =>
    side === 'buy' ? 1 - best.value / other.value : 1 - other.value / best.value;
  const edgeVsNext = edge(next);
  let reason: NoVerdictReason | null = null;
  if (edgeVsNext < input.settings.minEdge) reason = 'small-difference';
  else if (best.quote.volume === null) reason = 'unknown-volume';
  else if (best.quote.volume < input.settings.minPairVolume) reason = 'low-volume';
  return {
    side,
    options,
    verdict: reason ? null : { currency: best.currency, edgeVsNext, edgeVsWorst: edge(worst) },
    reason,
  };
}
