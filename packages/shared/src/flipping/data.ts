import { z } from 'zod';

/** Hub currencies of the currency exchange (spec 04, §1). Ids are poe.ninja item ids. */
export const HUBS = ['divine', 'exalted', 'chaos'] as const;
export type Hub = (typeof HUBS)[number];
export const hubSchema = z.enum(HUBS);

/** One side of a flip: the item ↔ hub market, prices in hub units per 1 item. */
export const flipLegSchema = z.object({
  hub: hubSchema,
  /** Volume-weighted average of the newest hour. */
  avg: z.number(),
  low: z.number(),
  high: z.number(),
  /** Item units traded on this market over the window. */
  units24h: z.number(),
  /** Divine value traded on this market over the window. */
  value24h: z.number(),
});
export type FlipLeg = z.infer<typeof flipLegSchema>;

export const flipSchema = z.object({
  id: z.string(),
  /** `spread`: buy low / sell high in one market; `cross`: buy with one hub, sell for another. */
  kind: z.enum(['spread', 'cross']),
  /** poe.ninja item id. */
  item: z.string(),
  buy: flipLegSchema,
  sell: flipLegSchema,
  /** Cross flips: units of `to` per 1 `from` (average and best of the newest hour). */
  convert: z
    .object({ from: hubSchema, to: hubSchema, avg: z.number(), best: z.number() })
    .nullable(),
  /** Margin of the newest hour (0.05 = 5 %): average prices for cross, range for spread. */
  margin: z.number(),
  /** Margin at the most favourable end of every range of the newest hour. */
  bestMargin: z.number(),
  /** Minimum over the legs of the units / divine value traded over the window. */
  units24h: z.number(),
  value24h: z.number(),
  /** Margin of each hour of the file's `hours` (null: not computable that hour). */
  hourly: z.array(z.number().nullable()),
});
export type Flip = z.infer<typeof flipSchema>;

/** `data/<game>/<league>/flips.json`. */
export const flipsFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  generatedAt: z.iso.datetime(),
  /** Hours of the window (start, unix seconds), ascending; the last one is "now". */
  hours: z.array(z.number()),
  flips: z.array(flipSchema),
});
export type FlipsFile = z.infer<typeof flipsFileSchema>;
