# Crafting Recipes (v1.0 — agreed 2026-10-24)

Backlog item 3 (`02-backlog.md`). Games: **PoE 2** (unit **divine**) and **PoE 1** (unit
**chaos**, divine alongside; §7, C16). Decisions are logged in `open-questions.md` §
"Crafting recipes" (C-numbered).

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

Schema: `packages/shared/src/crafting/recipe.ts` (zod; validated on save and on import).

```ts
interface Recipe {
  id: string; // uuid
  name: string;
  game: 'poe2' | 'poe1';
  notes?: string;
  bases: {
    baseId: string;
    minItemLevel?: number;
    rarity?: 'normal' | 'magic' | 'rare';
    price: number;
  }[];
  baseMods?: ModCondition; // what to look for on the base before step 1
  target?: ModCondition; // finished item, informative
  steps: Step[];
  priceOverrides: Record<string, number>; // exchange item id → game unit (C12)
  updatedAt: string; // ISO
}

type CraftAction = { itemId: string; count: number }[]; // exchange item ids used together

type Step =
  | { id; label?; kind: 'apply'; action: CraftAction; times: number }
  | {
      id;
      label?;
      kind: 'loop';
      until?: ModCondition;
      uses: { action: CraftAction; expectedUses: number }[];
    }
  | {
      id;
      label?;
      kind: 'gate';
      action: CraftAction;
      success?: ModCondition;
      successChance: number;
      onFail: { recovery?: CraftAction; goto: string };
    } // goto: this or an earlier step id, or 'base'
  | { id; label?; kind: 'best-effort'; action: CraftAction; expectedUses: number };

type ModCondition =
  | { family: string; tier?: number } // RePoE mod `type` at tier ≤ n (1 = best for the base)
  | { anyOf: ModCondition[] }
  | { allOf: ModCondition[] }
  | { atLeast: number; of: ModCondition[] };
```

Rules (validated by a zod schema on save and on import):

- `goto` targets the gate itself, an **earlier** step, or `'base'` = restart with a new base
  (re-buys it).
- Conditions name a **mod family** (RePoE `type`) and a tier: tiers are ranked per base
  (spawnable tiers of the family on the recipe's bases, highest level = T1). A family id is
  stable across tiers, so computed odds can use it later.
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
- `gate` with chance `p`, retrying from step `X` (or the base): each attempt repeats the
  passes from `X` up to the gate, so on average they run `1 / p` times as often and the
  recovery runs `(1 − p) / p` times. Nested and overlapping gates compose: the engine
  (`packages/shared/src/crafting/engine.ts`) computes the expected number of runs of every
  pass (base, step, recovery) as a linear recursion, `E(after gate) = E(before X) +
(E(before gate) − E(before X) + gate) / p + recovery × (1 − p) / p`, then prices them.
  The same runs give the **shopping list** (expected uses per item).
- Total = base price (× expected base purchases when a gate goes to `'base'`) + Σ steps.

The page shows, per step: action icons, uses, unit prices, step cost, share of total;
and the total. Items missing a price and an override show `?` and mark the total
incomplete.

## 4. Data

- **Prices**: existing `current.json` (PoE 2 exchange items, hourly). No new poe.ninja
  calls.
- **Mod list** (C3): RePoE PoE 2 `mods.json` (`https://repoe-fork.github.io/poe2/`), item
  prefixes / suffixes only, trimmed to id, name, family, kind, level, text, spawn weights
  (kept for the later computed odds) → `packages/shared/data/crafting-mods-poe2.json`.
- **Bases**: RePoE `base_items.json`, released bases of the craftable item classes →
  `packages/shared/data/crafting-bases-poe2.json`.
- Both are regenerated by the probe workflow (`source: crafting`, `pnpm probe:crafting`)
  after a patch, committed, and bundled by Vite as hashed assets fetched only by this tool.

## 5. Editor

- **Item picker** (C9): category first (exchange categories used for crafting: Currency,
  Omens, Essences, Abyssal Bones, Catalysts, Runes, Soul Cores, Idols, Liquid Emotions,
  Expedition, Verisium), then the item; a search covers all of them.
- **Linked items** (C9): an action offers the curated companions of its items, like
  Craft of Exile — Exalted Orbs → Omens of Greater / Sinistral / Dextral / Catalysing
  Exaltation; Chaos Orbs → Omens of Whittling / Sinistral / Dextral Erasure; Annulment →
  Sinistral / Dextral Annulment, Light; Perfect Essences → Crystallisation omens; Abyssal
  bones → Necromancy, Sovereign, Liege… Table in `packages/shared/src/crafting/linked.ts`
  (maintained per league).
- **Mod picker**: autocomplete over the mod list, filtered by the selected bases' item
  class; tier selector.
- **Base picker**: autocomplete over bases, typed price in divine.
- Steps: add / reorder / delete; `goto` chooses from earlier steps.

## 6. Pages

- `/tools/crafting-recipes` — list of saved recipes (name, first base, steps, expected total
  with the first base, updated); New / Import / Export all.
- `?recipe=<id>[&base=<n>]` — recipe view: base selector, key figures (expected total, base,
  currency, unpriced items), step table (one pass, expected passes, expected cost, share)
  and shopping list. Edit / Duplicate / Export / Delete.
- `?recipe=<id>&edit=1` (`recipe=new` for a new one) — editor; Save validates.

## 7. PoE 1 (C16)

Same tool, model and engine; what changes with the game switch:

- **Unit**: prices, base prices and overrides are in **chaos** (divine shown alongside, spec
  07 §3). Prices come from the PoE 1 `current.json`.
- **Recipes**: one list per game (`poe-tools:crafting-recipes:<game>`); a recipe carries its
  `game`. Import keeps the recipes of the selected game and says how many of the other
  game it left out.
- **Mods / bases**: RePoE PoE 1 export (`https://repoe-fork.github.io/`) →
  `crafting-{mods,bases}-poe1.json`, same trimming (probe workflow `source: crafting`,
  `game: poe1`). Item classes add Rune Dagger, Thrusting One Hand Sword, Abyss Jewel and the
  PoE 1 flasks. Influence, delve (fossil), bench and veiled mods are not in the list
  (domain / spawn weights): conditions name natural mods and essence mods.
- **Item picker**: Currency (catalysts, lifeforce, eldritch currency included), Essences,
  Fossils, Resonators, Omens, Oils.
- **Linked items**: a fossil offers the four chaotic resonators. PoE 1 has no crafting omens
  on the exchange (3.29); the table is updated per league.

## 8. Later

- Computed odds from spawn weights (C2), filling `expectedUses` / `successChance`.
- Desecration ("reveal one of three") and other mechanics as needed; a give-up exit for
  loops; recipes shared by link.
