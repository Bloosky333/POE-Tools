import { z } from 'zod';

/*
 * Crafting recipe model (spec 08 §2). Recipes are made in the browser and stored in
 * localStorage; this schema validates them on save and on import.
 */

/** One item used by an action: an exchange item id (`exalted`, `omen-of-whittling`…). */
export const itemUseSchema = z.object({
  itemId: z.string().min(1),
  count: z.number().positive().default(1),
});
export type ItemUse = z.infer<typeof itemUseSchema>;

/** Items used together, e.g. Omen of Greater Exaltation + Exalted Orb. */
export const actionSchema = z.array(itemUseSchema).min(1);
export type CraftAction = z.infer<typeof actionSchema>;

export type ModCondition =
  | { family: string; tier?: number | undefined }
  | { anyOf: ModCondition[] }
  | { allOf: ModCondition[] }
  | { atLeast: number; of: ModCondition[] };

/**
 * A mod family (RePoE mod `type`) at `tier` or better (1 = best for the base), or a
 * combination. Informative in v1; the input of computed odds later (C2).
 */
export const modConditionSchema: z.ZodType<ModCondition> = z.lazy(() =>
  z.union([
    z.object({ family: z.string().min(1), tier: z.number().int().positive().optional() }),
    z.object({ anyOf: z.array(modConditionSchema).min(1) }),
    z.object({ allOf: z.array(modConditionSchema).min(1) }),
    z.object({ atLeast: z.number().int().positive(), of: z.array(modConditionSchema).min(1) }),
  ]),
);

const stepBase = {
  id: z.string().min(1),
  label: z.string().optional(),
};

/** Restart point of a failed gate: an earlier step id, or `base` (buy a new base). */
export const BASE_STEP = 'base';

export const stepSchema = z.discriminatedUnion('kind', [
  z.object({
    ...stepBase,
    kind: z.literal('apply'),
    action: actionSchema,
    times: z.number().positive().default(1),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('loop'),
    until: modConditionSchema.optional(),
    /** Expected uses per action until the condition holds (C4). */
    uses: z
      .array(z.object({ action: actionSchema, expectedUses: z.number().nonnegative() }))
      .min(1),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('gate'),
    action: actionSchema,
    success: modConditionSchema.optional(),
    /** 0–1, typed in (C2). */
    successChance: z.number().gt(0).max(1),
    onFail: z.object({ recovery: actionSchema.optional(), goto: z.string().min(1) }),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('best-effort'),
    action: actionSchema,
    expectedUses: z.number().nonnegative(),
  }),
]);
export type Step = z.infer<typeof stepSchema>;
export type StepKind = Step['kind'];

export const RARITIES = ['normal', 'magic', 'rare'] as const;

export const baseOptionSchema = z.object({
  baseId: z.string().min(1),
  minItemLevel: z.number().int().positive().optional(),
  rarity: z.enum(RARITIES).optional(),
  /** Typed-in price in divine (C5). */
  price: z.number().nonnegative().default(0),
});
export type BaseOption = z.infer<typeof baseOptionSchema>;

export const recipeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    game: z.literal('poe2'),
    notes: z.string().optional(),
    bases: z.array(baseOptionSchema),
    baseMods: modConditionSchema.optional(),
    target: modConditionSchema.optional(),
    steps: z.array(stepSchema),
    /** Item id → divine; replaces or fills in for the live price (C12). */
    priceOverrides: z.record(z.string(), z.number().nonnegative()).default({}),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((recipe, ctx) => {
    const seen = new Set<string>();
    recipe.steps.forEach((step, i) => {
      if (seen.has(step.id) || step.id === BASE_STEP) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate step id ${step.id}`,
          path: ['steps', i],
        });
      }
      seen.add(step.id);
      if (step.kind === 'gate' && step.onFail.goto !== BASE_STEP && !seen.has(step.onFail.goto)) {
        ctx.addIssue({
          code: 'custom',
          message: 'A failed gate must go back to this step, an earlier one or a new base',
          path: ['steps', i, 'onFail', 'goto'],
        });
      }
    });
  });
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeInput = z.input<typeof recipeSchema>;

/** JSON export / import file (C11). */
export const recipesExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  recipes: z.array(recipeSchema),
});
export type RecipesExport = z.infer<typeof recipesExportSchema>;

/** Every item id a recipe uses, in step order. */
export function recipeItemIds(recipe: Recipe): string[] {
  const ids = new Set<string>();
  for (const step of recipe.steps) {
    for (const action of stepActions(step)) for (const use of action) ids.add(use.itemId);
  }
  return [...ids];
}

/** The actions of a step (a gate's recovery included). */
export function stepActions(step: Step): CraftAction[] {
  switch (step.kind) {
    case 'loop':
      return step.uses.map((u) => u.action);
    case 'gate':
      return step.onFail.recovery ? [step.action, step.onFail.recovery] : [step.action];
    default:
      return [step.action];
  }
}
