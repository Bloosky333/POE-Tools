import {
  recipeSchema,
  recipesExportSchema,
  type CraftAction,
  type Game,
  type Recipe,
  type RecipesExport,
  type Step,
  type StepKind,
} from '@poe-tools/shared';

/*
 * Recipes live in the browser (spec 08, C1) and move between browsers as JSON files
 * (C11). Invalid stored entries are dropped on load rather than breaking the page.
 */

/** One list per game (prices, items and mods differ). */
const storageKey = (game: Game) => `poe-tools:crafting-recipes:${game}`;

export function loadRecipes(game: Game): Recipe[] {
  try {
    const raw = localStorage.getItem(storageKey(game));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((entry) => {
      const parsed = recipeSchema.safeParse(entry);
      return parsed.success && parsed.data.game === game ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function storeRecipes(game: Game, recipes: readonly Recipe[]): void {
  try {
    localStorage.setItem(storageKey(game), JSON.stringify(recipes));
  } catch {
    // Storage full or unavailable: the change lives until the page reloads.
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newRecipe(game: Game, now = new Date()): Recipe {
  return {
    id: newId(),
    name: 'New recipe',
    game,
    bases: [],
    steps: [],
    priceOverrides: {},
    updatedAt: now.toISOString(),
  };
}

const EMPTY_ACTION: CraftAction = [];

/** A blank step of `kind` (its action is filled in the editor). */
export function newStep(kind: StepKind): Step {
  const id = newId();
  switch (kind) {
    case 'apply':
      return { id, kind, action: EMPTY_ACTION, times: 1 };
    case 'loop':
      return { id, kind, uses: [{ action: EMPTY_ACTION, expectedUses: 10 }] };
    case 'gate':
      return { id, kind, action: EMPTY_ACTION, successChance: 0.5, onFail: { goto: 'base' } };
    case 'best-effort':
      return { id, kind, action: EMPTY_ACTION, expectedUses: 1 };
  }
}

export function exportFile(recipes: readonly Recipe[], now = new Date()): RecipesExport {
  return { version: 1, exportedAt: now.toISOString(), recipes: [...recipes] };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses an export file (or a bare recipe / list of recipes). Throws with a readable
 * message when the file isn't a recipe export.
 */
export function parseImport(text: string): Recipe[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Not a JSON file');
  }
  const file = recipesExportSchema.safeParse(json);
  if (file.success) return file.data.recipes;
  const list = recipeSchema.array().safeParse(Array.isArray(json) ? json : [json]);
  if (list.success) return list.data;
  throw new Error(`Not a recipe export: ${file.error.issues[0]?.message ?? 'invalid content'}`);
}

/**
 * Adds imported recipes of `game`: same id → replaced by the newer `updatedAt` (kept
 * otherwise). Returns the merged list, how many recipes were added or updated and how many
 * belong to the other game (left out).
 */
export function mergeImport(
  game: Game,
  existing: readonly Recipe[],
  imported: readonly Recipe[],
): { recipes: Recipe[]; changed: number; otherGame: number } {
  const byId = new Map(existing.map((r) => [r.id, r]));
  let changed = 0;
  let otherGame = 0;
  for (const recipe of imported) {
    if (recipe.game !== game) {
      otherGame++;
      continue;
    }
    const current = byId.get(recipe.id);
    if (current && current.updatedAt >= recipe.updatedAt) continue;
    byId.set(recipe.id, recipe);
    changed++;
  }
  return { recipes: [...byId.values()], changed, otherGame };
}
