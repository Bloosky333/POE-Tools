export const GAMES = ['poe2', 'poe1'] as const;

export type Game = (typeof GAMES)[number];

export const GAME_LABELS: Record<Game, string> = {
  poe2: 'Path of Exile 2',
  poe1: 'Path of Exile 1',
};

/** Games whose tools are usable today; others are shown as "coming soon". */
export const ENABLED_GAMES: readonly Game[] = ['poe2', 'poe1'];

/** The three currencies that matter on the exchange (poe.ninja item ids). */
export const CORE_CURRENCIES = ['divine', 'exalted', 'chaos'] as const;
export type CoreCurrency = (typeof CORE_CURRENCIES)[number];

export const CURRENCY_SHORT: Record<CoreCurrency, string> = {
  divine: 'div',
  exalted: 'ex',
  chaos: 'c',
};

export const CURRENCY_NAMES: Record<CoreCurrency, string> = {
  divine: 'Divine Orb',
  exalted: 'Exalted Orb',
  chaos: 'Chaos Orb',
};

/**
 * Economy of a game (spec 07 §6.1): the unit prices are expressed in, the currencies the
 * exchange revolves around and the thresholds that carry that unit.
 */
export interface GameEconomy {
  /** Unit of every price and volume (poe.ninja `core.primary`); never listed as an item. */
  unit: CoreCurrency;
  /** Shown next to prices, converted at the current rate (PoE 1: divine); null = none. */
  secondary: CoreCurrency | null;
  /** poe.ninja `core.rates` kept in the daily fx series: units per 1 `unit`. */
  fxCurrencies: readonly CoreCurrency[];
  /** Hub currencies of the exchange = what an item can be paid with (flipping, Buy With, Sell For). */
  hubs: readonly CoreCurrency[];
  /** Min price of an item counted in market-wide measures (market factor, market move). */
  minPrice: number;
  /** Min daily volume: liquid enough for BUY NOW and market-wide measures. */
  minVolume: number;
  /** Daily volume at which the liquidity part of confidence saturates. */
  liquiditySaturation: number;
  /** Min daily volume for an item to get its details history (data job). */
  historyMinVolume: number;
  /** Flips with a leg trading less than this over the window are not published. */
  flipMinLegValue: number;
  /** Default of the flipping page's min value per leg (24 h). */
  flipDefaultValue: number;
  /** Buy With / Sell For: the recommended pair must trade at least this per day. */
  pairMinVolume: number;
}

export const ECONOMY: Record<Game, GameEconomy> = {
  poe2: {
    unit: 'divine',
    secondary: null,
    fxCurrencies: ['exalted', 'chaos'],
    hubs: ['divine', 'exalted', 'chaos'],
    minPrice: 0.05,
    minVolume: 5,
    liquiditySaturation: 50,
    historyMinVolume: 2,
    flipMinLegValue: 10,
    flipDefaultValue: 120,
    pairMinVolume: 1,
  },
  // Chaos-denominated: 1 div ≈ 330 c in 3.29 (probe, 2026-10-24). Starting values, spec 07 §9.
  poe1: {
    unit: 'chaos',
    secondary: 'divine',
    fxCurrencies: ['divine'],
    hubs: ['chaos', 'divine'],
    minPrice: 1,
    minVolume: 1000,
    liquiditySaturation: 15000,
    historyMinVolume: 300,
    flipMinLegValue: 2000,
    flipDefaultValue: 20000,
    pairMinVolume: 200,
  },
};
