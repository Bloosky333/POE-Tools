import { z } from 'zod';

/*
 * Static crafting data (spec 08 §4), trimmed from the RePoE PoE 2 export by the probe
 * workflow (`source: crafting`) into `packages/shared/data/`.
 */

export const craftingModSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Mod family (RePoE `type`): the tiers of one mod share it. */
  family: z.string(),
  kind: z.enum(['prefix', 'suffix']),
  level: z.number(),
  text: z.string(),
  /** Spawn weights in game order: the first tag the base has decides. */
  weights: z.array(z.tuple([z.string(), z.number()])),
  essenceOnly: z.boolean().optional(),
});
export type CraftingMod = z.infer<typeof craftingModSchema>;

export const craftingModsFileSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  source: z.string(),
  mods: z.array(craftingModSchema),
});
export type CraftingModsFile = z.infer<typeof craftingModsFileSchema>;

export const craftingBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  itemClass: z.string(),
  level: z.number(),
  tags: z.array(z.string()),
});
export type CraftingBase = z.infer<typeof craftingBaseSchema>;

export const craftingBasesFileSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  source: z.string(),
  bases: z.array(craftingBaseSchema),
});
export type CraftingBasesFile = z.infer<typeof craftingBasesFileSchema>;
