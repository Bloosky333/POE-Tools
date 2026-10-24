import { z } from 'zod';
import { leaguesSchema } from './leagues.ts';

/** poe.ninja PoE 2 currency-exchange overview categories (official docs, 2026-10). */
export const POE2_EXCHANGE_TYPES = [
  'Currency',
  'Fragments',
  'Abyss',
  'UncutGems',
  'LineageSupportGems',
  'Essences',
  'SoulCores',
  'Idols',
  'Runes',
  'Ritual',
  'Expedition',
  'Delirium',
  'Breach',
  'Verisium',
] as const;

export type ExchangeType = (typeof POE2_EXCHANGE_TYPES)[number];

export const EXCHANGE_TYPE_LABELS: Record<ExchangeType, string> = {
  Currency: 'Currency',
  Fragments: 'Fragments',
  Abyss: 'Abyssal Bones',
  UncutGems: 'Uncut Gems',
  LineageSupportGems: 'Lineage Gems',
  Essences: 'Essences',
  SoulCores: 'Soul Cores',
  Idols: 'Idols',
  Runes: 'Runes',
  Ritual: 'Omens',
  Expedition: 'Expedition',
  Delirium: 'Liquid Emotions',
  Breach: 'Catalysts',
  Verisium: 'Verisium',
};

const exchangeTypeSchema = z.enum(POE2_EXCHANGE_TYPES);

/*
 * Files published with the site under `data/`. All prices and volumes are in divine.
 */

export const leaguesFileSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  leagues: leaguesSchema,
});
export type LeaguesFile = z.infer<typeof leaguesFileSchema>;

export const currentItemSchema = z.object({
  id: z.string(),
  detailsId: z.string(),
  name: z.string(),
  icon: z.string(),
  type: exchangeTypeSchema,
  price: z.number(),
  /** Traded volume over the last day, in divine. */
  volume: z.number(),
  /** Price change over the last 7 days, in %. */
  change7d: z.number().nullable(),
});
export type CurrentItem = z.infer<typeof currentItemSchema>;

export const currentFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  fetchedAt: z.iso.datetime(),
  /** Units per 1 divine. */
  rates: z.object({ exalted: z.number(), chaos: z.number() }),
  items: z.array(currentItemSchema),
});
export type CurrentFile = z.infer<typeof currentFileSchema>;

/** `[leagueDay, priceDiv, volumeDiv]`, sorted by day. */
export const historyPointSchema = z.tuple([z.number(), z.number(), z.number()]);
export type HistoryPoint = z.infer<typeof historyPointSchema>;

export const historyFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  type: exchangeTypeSchema,
  items: z.record(z.string(), z.array(historyPointSchema)),
});
export type HistoryFile = z.infer<typeof historyFileSchema>;

/** `[leagueDay, exaltedPerDivine, chaosPerDivine]`, sorted by day. */
export const fxFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  points: z.array(z.tuple([z.number(), z.number().nullable(), z.number().nullable()])),
});
export type FxFile = z.infer<typeof fxFileSchema>;

/** Currencies an exchange item can be paid with (its pairs on the currency exchange). */
export const PAY_CURRENCIES = ['divine', 'exalted', 'chaos'] as const;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];

export const pairQuoteSchema = z.object({
  /** Units of the pay currency per 1 item. */
  rate: z.number(),
  /** Volume traded on this pair over a day, in divine; null when unknown. */
  volume: z.number().nullable(),
  /** End of the traded day (`daily`) or fetch time of the overview (`hourly`). */
  asOf: z.iso.datetime(),
  /** `daily`: details pass; `hourly`: the item's busiest pair from the overview. */
  source: z.enum(['daily', 'hourly']),
});
export type PairQuote = z.infer<typeof pairQuoteSchema>;

/** Per-pair rates of every item (tool #2, spec 04 §2.3). */
export const pairsFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  generatedAt: z.iso.datetime(),
  items: z.record(z.string(), z.partialRecord(z.enum(PAY_CURRENCIES), pairQuoteSchema)),
});
export type PairsFile = z.infer<typeof pairsFileSchema>;

export const dataPaths = {
  leagues: (game: string) => `${game}/leagues.json`,
  current: (game: string, leagueId: string) => `${game}/${leagueId}/current.json`,
  history: (game: string, leagueId: string, type: ExchangeType) =>
    `${game}/${leagueId}/history/${type}.json`,
  fx: (game: string, leagueId: string) => `${game}/${leagueId}/fx.json`,
  pairs: (game: string, leagueId: string) => `${game}/${leagueId}/pairs.json`,
};
