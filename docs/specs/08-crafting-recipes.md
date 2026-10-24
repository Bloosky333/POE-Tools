# Crafting Recipes (draft v0.2 — under discussion)

Backlog item 3 (`02-backlog.md`). Game: **PoE 2** only (C7). Unit: **divine**. Decisions are
logged in `open-questions.md` § "Crafting recipes" (C-numbered).

## 1. Goal

A personal catalogue of crafting recipes, each shown as a readable step list with the
**live cost** of every step and an **expected total cost** (C6). No live tracker, no
method comparison in v1.

- Recipes are **built in an in-app editor** and stored in the browser (localStorage),
  backed up and moved with **JSON export/import** (C1, C11; same pattern as positions,
  Q12). No built-in recipes, no share links.
- Odds are **typed in** for v1; the model keeps stable mod ids so **computed odds** (mod
  weights) can fill the same fields later (C2).

## 2. Recipe model

A recipe is a small **flow of steps**. Four step kinds:

| Kind          | Meaning                                                                      | Example                                      |
| ------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `apply`       | Use the action once (or `n` times) and move on.                              | Regal Orb; Omen of Sinistral + Exalted Orb   |
| `loop`        | Repeat its actions **until** a condition holds, then move on.                | Augment / Annul until T1 life _or_ T1 armour |
| `gate`        | Use the action once; on success move on, on failure (recover, then) go to X. | Fracturing Orb: wrong mod → step 1           |
| `best-effort` | Use the action an expected number of times, no condition to reach.           | Whittling until the worst mod is gone        |

An **action** is one or more items used together: `[Omen of Greater Exaltation, Exalted
Orb]` counts as one use of each.

```ts
interface Recipe {
  id: string; // uuid
  name: string;
  game: 'poe2';
  notes?: string;
  bases: BaseOption[]; // one or several; the page shows one at a time (C13)
  baseMods?: ModCondition; // what to look for on the base before step 1 (optional)
  target?: ModCondition; // finished item, informative
  steps: Step[];
  priceOverrides?: Record<string, number>; // item id → divine (C12)
  updatedAt: string; // ISO
}

interface BaseOption {
  baseId: string; // RePoE base item id → name, item class
  minItemLevel?: number;
  rarity?: 'normal' | 'magic' | 'rare';
  price: number; // divine, typed in (C5)
}

interface ItemUse {
  itemId: string; // exchange item id (poe.ninja / GGG), see §4
  count?: number; // default 1
}
type Action = ItemUse[]; // items used together

type Step =
  | { id: string; kind: 'apply'; label?: string; action: Action; times?: number }
  | {
      id: string;
      kind: 'loop';
      label?: string;
      until: ModCondition;
      uses: { action: Action; expectedUses: number }[]; // C4: e.g. Augment ×30, Annul ×25
    }
  | {
      id: string;
      kind: 'gate';
      label?: string;
      action: Action;
      success: ModCondition;
      successChance: number; // 0–1, typed in (C2)
      onFail: { recovery?: Action; goto: string }; // C8; goto = an earlier step id or 'base'
    }
  | { id: string; kind: 'best-effort'; label?: string; action: Action; expectedUses: number };

type ModCondition =
  | { modId: string; minTier?: number } // mod picked from the mod list (C3)
  | { anyOf: ModCondition[] } // "T1 life OR T1 armour"
  | { allOf: ModCondition[] }
  | { atLeast: number; of: ModCondition[] };
```

Rules (validated by a zod schema on save and on import):

- `goto` targets an **earlier** step, or `'base'` = restart with a new base (re-buys it).
- Loops have no `goto`: they end only when `until` holds.
- Conditions are informative in v1 (odds are typed in); they become the input of computed
  odds later.

## 3. Expected cost

All in divine, using the **selected base** (C13) and live prices (manual override wins,
C12). Average only, no percentiles (C10).

- Cost of an action `A`: `c(A) = Σ count × price(item)`.
- `apply`: `times × c(A)`.
- `loop`: `Σ expectedUses × c(action)`.
- `best-effort`: `expectedUses × c(A)`.
- `gate` with chance `p`, retrying from step `X` (or the base): let `S` = cost of the steps
  from `X` up to and including the gate's action, `r = c(recovery)`. Attempts are
  geometric (`1 / p` on average, `(1 − p) / p` failures), so the segment costs
  `S / p + r × (1 − p) / p`. Steps before `X` are paid once.
- **Nested gates**: process gates in order; a later gate whose `goto` lands before an
  earlier gate includes that gate's expected cost (not its single-attempt cost) in `S`.
- Total = base price (× expected base purchases when a gate goes to `'base'`) + Σ steps.

The page shows, per step: action icons, uses, unit prices, step cost, share of total;
and the total. Items missing a price and an override show `?` and mark the total
incomplete.

## 4. Data

- **Prices**: existing `current.json` (PoE 2 exchange items, hourly). No new poe.ninja
  calls.
- **Mod list** (new, C3): the RePoE PoE 2 export (`https://repoe-fork.github.io/poe2/`,
  already used for base names) trimmed by the probe workflow to the fields the editor
  needs — mod id, text, tier, prefix/suffix, generation type, item classes / tags, level —
  and committed to `packages/data-job/data/` like `exchange-base-items.json`, then
  shipped as a lazy-loaded `mods.json` (only fetched by this tool). Spawn weights are kept
  in the file for the later computed odds.
- **Bases**: RePoE `base_items.json` (equipment bases only) → `bases.json`, same pipeline.

## 5. Editor

- **Item picker** (C9): category first (Currency, Omens, Essences, Catalysts, Abyss /
  Desecration, Runes & Soul Cores, …, from the exchange categories), then the item.
- **Linked items** (C9): picking a base currency offers its curated companions, like
  Craft of Exile — e.g. Exalted Orb → Omen of Greater / Sinistral / Dextral Exaltation;
  Chaos Orb → Omens of Whittling / Sinistral / Dextral Erasure; Regal → Omen of
  Homogenising Coronation. Curated table in `packages/shared` (maintained per league).
- **Mod picker**: autocomplete over the mod list, filtered by the selected bases' item
  class; tier selector.
- **Base picker**: autocomplete over bases, typed price in divine.
- Steps: add / reorder / delete; `goto` chooses from earlier steps.

## 6. Pages

- `/tools/crafting-recipes` — list of saved recipes (name, base, expected total, updated);
  new / import / export all.
- `/tools/crafting-recipes/:id` — recipe view (base selector, step table, total) with an
  Edit toggle.

## 7. Open questions

See `open-questions.md` § "Crafting recipes" — still open: C14+.
