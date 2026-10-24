import type { CraftingBase, CraftingMod } from './data.ts';
import type { ModCondition } from './recipe.ts';

/** Spawn weight of a mod on a base: the first of the mod's tags the base has decides. */
export function modWeight(mod: CraftingMod, tags: ReadonlySet<string>): number {
  for (const [tag, weight] of mod.weights) if (tags.has(tag)) return weight;
  return 0;
}

export interface ModFamily {
  family: string;
  kind: CraftingMod['kind'];
  /** Tiers, best (highest level) first: `tiers[0]` is T1. */
  tiers: CraftingMod[];
  /** Text of the best tier, used as the family's label. */
  text: string;
}

/**
 * Mod families that can roll on `bases` (any of them), with tiers ranked for those bases.
 * Without bases, every family with every tier (essence-only mods aside).
 */
export function modFamilies(
  mods: readonly CraftingMod[],
  bases: readonly CraftingBase[] = [],
): ModFamily[] {
  const tagSets = bases.map((b) => new Set(b.tags));
  const byFamily = new Map<string, CraftingMod[]>();
  for (const mod of mods) {
    const rolls = tagSets.length
      ? tagSets.some((tags) => modWeight(mod, tags) > 0)
      : !mod.essenceOnly;
    if (!rolls) continue;
    const list = byFamily.get(mod.family) ?? [];
    list.push(mod);
    byFamily.set(mod.family, list);
  }
  return [...byFamily].flatMap(([family, list]) => {
    const tiers = [...list].sort((a, b) => b.level - a.level);
    const best = tiers[0];
    return best ? [{ family, kind: best.kind, tiers, text: modText(best.text) }] : [];
  });
}

/** Mod text without the game's link markup: `[Allies|Allies in your Presence]` → the label. */
export function modText(text: string): string {
  return text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
}

/** Mod text with value ranges collapsed, e.g. `+(10-19) to maximum Life` → `+# to maximum Life`. */
export function genericText(text: string): string {
  return text
    .replace(/\(\s*-?[\d.]+\s*[-–]\s*-?[\d.]+\s*\)/g, '#')
    .replace(/(^|[^\w#])\d+(\.\d+)?/g, '$1#')
    .replace(/\n/g, ' / ');
}

/** One-line reading of a condition, e.g. `T1–T2 +# to maximum Life or 2 of: …`. */
export function describeCondition(
  condition: ModCondition,
  label: (family: string) => string = (f) => f,
): string {
  const inner = (c: ModCondition): string => {
    const text = describeCondition(c, label);
    return 'family' in c ? text : `(${text})`;
  };
  if ('family' in condition) {
    const tier =
      condition.tier === undefined ? '' : condition.tier === 1 ? 'T1 ' : `T1–T${condition.tier} `;
    return `${tier}${label(condition.family)}`;
  }
  if ('anyOf' in condition) return condition.anyOf.map(inner).join(' or ');
  if ('allOf' in condition) return condition.allOf.map(inner).join(' and ');
  return `${condition.atLeast} of: ${condition.of.map(inner).join(', ')}`;
}
