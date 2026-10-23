import { z } from 'zod';

/** Loose schemas: only fields we use are validated, extra fields are ignored. */

export const ninjaLeaguesSchema = z.array(z.object({ id: z.string(), name: z.string() }));

const coreSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  /** Units of each currency per 1 primary (divine). */
  rates: z.record(z.string(), z.number()),
});

export const exchangeOverviewSchema = z.object({
  core: coreSchema,
  lines: z.array(
    z.object({
      id: z.string(),
      primaryValue: z.number(),
      volumePrimaryValue: z.number().nullish(),
      sparkline: z.object({ totalChange: z.number().nullish() }).nullish(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      image: z.string().nullish(),
      category: z.string().nullish(),
      detailsId: z.string(),
    }),
  ),
});
export type ExchangeOverview = z.infer<typeof exchangeOverviewSchema>;

export const exchangeDetailsSchema = z.object({
  item: z.object({ id: z.string(), detailsId: z.string() }),
  pairs: z.array(
    z.object({
      /** Pair currency id, e.g. "divine", "exalted", "chaos". */
      id: z.string(),
      history: z.array(
        z.object({
          timestamp: z.string(),
          /** Units of the pair currency per 1 item. */
          rate: z.number(),
          /** Volume in primary currency (divine). */
          volumePrimaryValue: z.number().nullish(),
        }),
      ),
    }),
  ),
  core: coreSchema,
});
export type ExchangeDetails = z.infer<typeof exchangeDetailsSchema>;
