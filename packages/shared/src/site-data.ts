import { z } from 'zod';
import { CORE_CURRENCIES, type Game } from './games.ts';
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

/**
 * poe.ninja PoE 1 exchange overview categories (docs + probe, 3.29 Allflame). League
 * mechanics come and go: updated with each new league (`DjinnCoin` was empty in 3.29).
 */
export const POE1_EXCHANGE_TYPES = [
  'Currency',
  'Fragment',
  'Runegraft',
  'AllflameEmber',
  'Tattoo',
  'Omen',
  'Ducat',
  'EnshroudingCrystal',
  'DivinationCard',
  'Artifact',
  'Oil',
  'DeliriumOrb',
  'Scarab',
  'Astrolabe',
  'Fossil',
  'Resonator',
  'Essence',
] as const;

export type ExchangeType =
  | (typeof POE2_EXCHANGE_TYPES)[number]
  | (typeof POE1_EXCHANGE_TYPES)[number];

/** Every exchange type of both games, PoE 2's first (display order). */
export const ALL_EXCHANGE_TYPES: readonly ExchangeType[] = [
  ...new Set<ExchangeType>([...POE2_EXCHANGE_TYPES, ...POE1_EXCHANGE_TYPES]),
];

export const EXCHANGE_TYPES: Record<Game, readonly ExchangeType[]> = {
  poe2: POE2_EXCHANGE_TYPES,
  poe1: POE1_EXCHANGE_TYPES,
};

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
  Fragment: 'Fragments',
  Runegraft: 'Runegrafts',
  AllflameEmber: 'Allflame Embers',
  Tattoo: 'Tattoos',
  Omen: 'Omens',
  Ducat: 'Ducats',
  EnshroudingCrystal: 'Enshrouding Crystals',
  DivinationCard: 'Divination Cards',
  Artifact: 'Artifacts',
  Oil: 'Oils',
  DeliriumOrb: 'Delirium Orbs',
  Scarab: 'Scarabs',
  Astrolabe: 'Astrolabes',
  Fossil: 'Fossils',
  Resonator: 'Resonators',
  Essence: 'Essences',
};

/** Whether `value` is one of the game's exchange types (e.g. a URL parameter). */
export function isExchangeType(game: Game, value: string): value is ExchangeType {
  return (EXCHANGE_TYPES[game] as readonly string[]).includes(value);
}

const exchangeTypeSchema = z.enum(ALL_EXCHANGE_TYPES as [ExchangeType, ...ExchangeType[]]);

/*
 * Files published with the site under `data/`. All prices and volumes are in the game's unit
 * (`ECONOMY[game].unit`: divine for PoE 2, chaos for PoE 1).
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
  /** Traded volume over the last day, in the game's unit. */
  volume: z.number(),
  /** Price change over the last 7 days, in %. */
  change7d: z.number().nullable(),
});
export type CurrentItem = z.infer<typeof currentItemSchema>;

export const currentFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  fetchedAt: z.iso.datetime(),
  /** Unit of prices and volumes (absent in older files: divine). */
  unit: z.enum(CORE_CURRENCIES).default('divine'),
  /** Units of each other core currency per 1 `unit` (poe.ninja `core.rates`). */
  rates: z.partialRecord(z.enum(CORE_CURRENCIES), z.number()),
  items: z.array(currentItemSchema),
});
export type CurrentFile = z.infer<typeof currentFileSchema>;

/** `[leagueDay, price, volume]` in the game's unit, sorted by day. */
export const historyPointSchema = z.tuple([z.number(), z.number(), z.number()]);
export type HistoryPoint = z.infer<typeof historyPointSchema>;

export const historyFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  type: exchangeTypeSchema,
  items: z.record(z.string(), z.array(historyPointSchema)),
});
export type HistoryFile = z.infer<typeof historyFileSchema>;

/** `[leagueDay, ...units of each of `currencies` per 1 unit]`, sorted by day. */
export const fxFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  currencies: z.array(z.enum(CORE_CURRENCIES)).default(['exalted', 'chaos']),
  points: z.array(z.tuple([z.number()], z.number().nullable())),
});
export type FxFile = z.infer<typeof fxFileSchema>;

/**
 * Currencies an exchange item can be paid with (its pairs on the currency exchange); a game
 * uses its `ECONOMY[game].hubs`.
 */
export const PAY_CURRENCIES = CORE_CURRENCIES;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];

export const pairQuoteSchema = z.object({
  /** Units of the pay currency per 1 item. */
  rate: z.number(),
  /** Volume traded on this pair over a day, in the game's unit; null when unknown. */
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
  flips: (game: string, leagueId: string) => `${game}/${leagueId}/flips.json`,
};
