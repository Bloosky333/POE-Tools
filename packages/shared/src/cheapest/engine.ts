import { ECONOMY, type CoreCurrency, type Game } from '../games.ts';
import type { PairQuote, PayCurrency } from '../site-data.ts';

/*
 * Cheapest Currency (spec 04-cheapest-currency §3): for N units of an item, compare paying
 * directly with each hub currency of the game, in whole units, and recommend one only when
 * it is meaningfully cheaper on a pair that actually trades.
 */

export interface CheapestSettings {
  /** Recommend only when this much cheaper than the next pair (0.05 = 5 %). */
  minSaving: number;
  /** ... and the cheapest pair traded at least this per day (game unit). */
  minPairVolume: number;
}

export function cheapestSettingsFor(game: Game): CheapestSettings {
  return { minSaving: 0.05, minPairVolume: ECONOMY[game].payMinVolume };
}

export interface PayOption {
  currency: PayCurrency;
  quote: PairQuote;
  /** Whole units of `currency` to hand over. */
  pay: number;
  /** Units paid beyond the exact price (rounding up to whole units). */
  waste: number;
  /** Real cost of `pay`, in the game's unit. */
  cost: number;
  /** Cost per item, in the game's unit. */
  unitPrice: number;
  /** Items the same `pay` buys at this rate (≥ the quantity asked). */
  cleanQuantity: number;
}

export type NoVerdictReason = 'single-pair' | 'small-difference' | 'low-volume' | 'unknown-volume';

export interface CheapestResult {
  /** Options sorted from cheapest to most expensive. */
  options: PayOption[];
  verdict: {
    currency: PayCurrency;
    /** Saving vs the next cheapest and vs the most expensive option (0.1 = 10 %). */
    savingVsNext: number;
    savingVsWorst: number;
  } | null;
  /** Why there is no verdict (null when there is one or no option at all). */
  reason: NoVerdictReason | null;
}

export interface CheapestInput {
  quotes: Partial<Record<PayCurrency, PairQuote>>;
  quantity: number;
  /** Game unit of costs. */
  unit: CoreCurrency;
  /** Units of each other currency per 1 `unit` (`current.json` rates). */
  rates: Partial<Record<CoreCurrency, number>>;
  /** Currencies the game pays with (its hubs). */
  currencies: readonly PayCurrency[];
  settings: CheapestSettings;
}

/** Tolerance on whole-unit rounding (rates are rounded to 6 significant digits). */
const EPSILON = 1e-9;

export function cheapest(input: CheapestInput): CheapestResult {
  const quantity = Math.max(1, Math.floor(input.quantity));
  const options: PayOption[] = [];
  for (const currency of input.currencies) {
    const quote = input.quotes[currency];
    const perUnit = currency === input.unit ? 1 : input.rates[currency];
    if (!quote || !(quote.rate > 0) || !perUnit) continue;
    const exact = quantity * quote.rate;
    const pay = Math.max(1, Math.ceil(exact - EPSILON * exact));
    const cost = pay / perUnit;
    options.push({
      currency,
      quote,
      pay,
      waste: Math.max(0, pay - exact),
      cost,
      unitPrice: cost / quantity,
      cleanQuantity: Math.max(quantity, Math.floor(pay / quote.rate + EPSILON)),
    });
  }
  options.sort((a, b) => a.cost - b.cost);

  const [best, next] = options;
  const worst = options.at(-1);
  if (!best) return { options, verdict: null, reason: null };
  if (!next || !worst) return { options, verdict: null, reason: 'single-pair' };
  const savingVsNext = 1 - best.cost / next.cost;
  let reason: NoVerdictReason | null = null;
  if (savingVsNext < input.settings.minSaving) reason = 'small-difference';
  else if (best.quote.volume === null) reason = 'unknown-volume';
  else if (best.quote.volume < input.settings.minPairVolume) reason = 'low-volume';
  return {
    options,
    verdict: reason
      ? null
      : { currency: best.currency, savingVsNext, savingVsWorst: 1 - best.cost / worst.cost },
    reason,
  };
}
