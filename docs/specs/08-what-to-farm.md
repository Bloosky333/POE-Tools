# What to Farm (v1.0 — agreed 2026-10-24)

Games: **PoE 2 and PoE 1**. Unit: divine (PoE 2), chaos with divine alongside (PoE 1, spec 07).
Same leagues, categories and data as tools #1 and Sell Now: **no new poe.ninja calls**; computed
in the browser from the site data, engine in `packages/shared/src/farm/`.

## 1. Goal

Rank the **league mechanics** (Breach, Delirium, Ritual, …) by how good their loot is to farm
**right now**: what it is worth, how easily it sells, where it is heading.

- **No yield** (decided): no source publishes drop rates, so no div/map or div/hour. The tool
  ranks loot, not strategies. A personal run log or a curated yield table may come later.
- **Loot side only** (decided): no input costs (waystones, tablets, scarabs) in v1.

## 2. Mechanic mapping

Hand-kept per game in `packages/shared/src/farm/mechanics-<game>.ts`, reviewed every league
(like `POE1_EXCHANGE_TYPES`): a default mechanic per exchange category, plus item-name
overrides for mixed categories. A category with no obvious mechanic is its own row (named after
the category).

| Role        | Meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| Mechanic    | Loot of one mechanic → one row.                                            |
| Any content | General drops → one greyed **baseline** row, to compare mechanics against. |
| Input       | Bought to run content, not farmed → excluded.                              |
| Ignored     | Drops that cannot be targeted by a mechanic (e.g. Idols) → excluded.       |

PoE 2 mapping (item names checked against the Forbidden Rites overviews):

| Category                                                  | Default     | Overrides                                                                 |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| Breach                                                    | Breach      |                                                                           |
| Delirium                                                  | Delirium    |                                                                           |
| Ritual                                                    | Ritual      |                                                                           |
| Expedition                                                | Expedition  |                                                                           |
| Abyss                                                     | Abyss       |                                                                           |
| Essences                                                  | Essences    |                                                                           |
| Verisium                                                  | Expedition  |                                                                           |
| Idols                                                     | Ignored     |                                                                           |
| Fragments                                                 | Bosses      | `Simulacrum*` → Delirium; `Breachlord Sac` → Breach; `* Fate` → Ultimatum |
| Currency, UncutGems, LineageSupportGems, Runes, SoulCores | Any content |                                                                           |

PoE 1 mapping (3.29 categories; redone for 3.30 at launch, categories change each league):

| Category                 | Default                        | Overrides                                       |
| ------------------------ | ------------------------------ | ----------------------------------------------- |
| Essence                  | Essences                       |                                                 |
| DeliriumOrb              | Delirium                       |                                                 |
| Fossil, Resonator        | Delve                          |                                                 |
| Oil                      | Blight                         |                                                 |
| Artifact, Tattoo         | Expedition                     |                                                 |
| Omen                     | Ritual                         |                                                 |
| Runegraft                | Kingsmarch                     |                                                 |
| EnshroudingCrystal       | Legion                         |                                                 |
| Ducat                    | own row (3.29 league mechanic) |                                                 |
| AllflameEmber            | own row                        |                                                 |
| Fragment                 | Bosses                         | `Simulacrum*` → Delirium; `Timeless *` → Legion |
| Currency, DivinationCard | Any content                    |                                                 |
| Scarab, Astrolabe        | Input                          |                                                 |

## 3. Metrics (per mechanic)

Liquid items only (spec 01 defaults: volume ≥ 5 div/day, price ≥ 0.05 div). Weight `w` of an
item = its 7-day average daily volume in div, **capped at 40 %** of the mechanic's total so one
item cannot be the whole index (tunable).

| Metric       | Definition                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Market size  | Sum of daily volume (div/day) of its liquid items.                                                            |
| Loot value   | Volume-weighted average price of its liquid items (the "typical unit you would sell").                        |
| Items        | Number of liquid items (+ the top 3 by volume shown in the row).                                              |
| Trend 7 d    | `Σ w × N(d)/N(d−7)` / `Σ w`, divided by the market's median 7-day change (as Sell Now).                       |
| Outlook 14 d | `Σ w × R(d+14)/R(d)` / `Σ w` over items with reference data, divided by the reference market's median change. |
| Index chart  | Same weighted index, daily, for both leagues (base 1 on the current league's day 7).                          |

## 4. Verdicts

| Verdict         | Rule (defaults, tunable)                                                                   |
| --------------- | ------------------------------------------------------------------------------------------ |
| **AVOID**       | Outlook ≤ ×0.85 vs market, **or** trend 7 d ≤ ×0.85 and outlook ≤ ×1 (Sell Now's Falling). |
| **FARM & HOLD** | Outlook ≥ ×1.15 vs market (farm now, sell later — link to Speculation).                    |
| **FARM & SELL** | Otherwise, with market size ≥ 50 div/day (loot sells; sell as you go).                     |
| **THIN**        | Otherwise (market too small to sell much).                                                 |

- **Confidence**: spec 01 §4.4 applied to the mechanic index: `100 × phase × (0.4 similarity of
the two index curves + 0.35 liquidity + 0.25 completeness)`, completeness = share of the
  mechanic's volume with reference history.
- **Ranking**: FARM & HOLD, FARM & SELL, THIN, AVOID; within each, outlook × confidence. The
  baseline row is pinned where its own values place it, greyed, without a verdict.

## 5. UI

Table: Mechanic, Verdict, Loot value, Market size, Items (top 3 icons), Trend 7 d, Outlook 14 d,
14-day index sparkline, Confidence. Filters (URL): min volume, min price, show THIN/AVOID.
Detail sheet: both-league index chart, item list with each item's share, price, trend and
outlook, links to the item in Speculation / Sell Now, confidence breakdown, mapping note
("hand-kept, items may be misassigned").

## 6. Backtest

`pnpm --filter @poe-tools/data-job backtest-farm --data-dir <data branch checkout> [--game poe1]`:
replay the verdicts over the current league's stored history (days 7–N) and compare each
mechanic index 14 days later vs the market, per verdict (as `backtest-sell`). Thresholds
(±15 %, 40 % cap, 50 div/day) are kept or changed from it and logged in `open-questions.md`.

## 7. League start

The page shows "waiting for data" until **day 7** of the current league (the 7-day trend needs
it; confidence is low before anyway). For PoE 1 3.30 (2026-11-13) that means from ~2026-11-20;
the mapping is updated for the 3.30 categories at launch.

## 8. Placement

Tool page only — no home-page widget (decided).
