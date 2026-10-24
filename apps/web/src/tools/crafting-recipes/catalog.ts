import {
  CRAFTING_EXCHANGE_TYPES,
  EXCHANGE_TYPE_LABELS,
  genericText,
  modFamilies,
  type CraftingBase,
  type CraftingMod,
  type CurrentItem,
  type ModFamily,
  type Recipe,
} from '@poe-tools/shared';
import { createContext, use } from 'react';
import type { UnitInfo } from '../../lib/unit.ts';

/** Everything the recipe pages look up: priced items, mods and bases. */
export interface Catalog {
  items: ReadonlyMap<string, CurrentItem>;
  /** Crafting items by picker category, most traded first. */
  categories: { type: string; label: string; items: CurrentItem[] }[];
  mods: readonly CraftingMod[];
  bases: readonly CraftingBase[];
  basesById: ReadonlyMap<string, CraftingBase>;
  /** Readable label of a mod family (`+# to maximum Life`), any base. */
  familyLabel: (family: string) => string;
  unit: UnitInfo;
}

export function buildCatalog(
  items: readonly CurrentItem[],
  mods: readonly CraftingMod[],
  bases: readonly CraftingBase[],
  unit: UnitInfo,
): Catalog {
  const categories = CRAFTING_EXCHANGE_TYPES.map((type) => ({
    type,
    label: EXCHANGE_TYPE_LABELS[type],
    items: items.filter((i) => i.type === type).sort((a, b) => b.volume - a.volume),
  })).filter((c) => c.items.length > 0);
  const labels = new Map(modFamilies(mods).map((f) => [f.family, familyText(f)]));
  return {
    items: new Map(items.map((i) => [i.id, i])),
    categories,
    mods,
    bases,
    basesById: new Map(bases.map((b) => [b.id, b])),
    familyLabel: (family) => labels.get(family) ?? family,
    unit,
  };
}

export function familyText(family: ModFamily): string {
  return genericText(family.text);
}

/** Bases of a recipe that exist in the base list. */
export function recipeBases(catalog: Catalog, recipe: Recipe): CraftingBase[] {
  return recipe.bases.flatMap((b) => {
    const base = catalog.basesById.get(b.baseId);
    return base ? [base] : [];
  });
}

/** Bases matching a search, one per name (the export lists some names twice). */
export function searchBases(bases: readonly CraftingBase[], q: string, limit = 12): CraftingBase[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const seen = new Set<string>();
  const out: CraftingBase[] = [];
  for (const base of bases) {
    if (out.length >= limit) break;
    const text = `${base.name} ${base.itemClass}`.toLowerCase();
    if (!query.split(/\s+/).every((word) => text.includes(word)) || seen.has(base.name)) continue;
    seen.add(base.name);
    out.push(base);
  }
  return out;
}

/** Mod families matching a search (text or family id), shortest text (plain mods) first. */
export function searchFamilies(families: readonly ModFamily[], q: string, limit = 15): ModFamily[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return families
    .filter((f) => {
      const text = `${familyText(f)} ${f.family} ${f.kind}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => familyText(a).length - familyText(b).length)
    .slice(0, limit);
}

export const CatalogContext = createContext<Catalog | null>(null);

export function useCatalog(): Catalog {
  const catalog = use(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used inside <CatalogContext>');
  return catalog;
}
