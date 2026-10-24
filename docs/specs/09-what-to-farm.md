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
item cannot be the whole index (tunable): the largest items get 40 % and the rest share the
remainder pro rata; with fewer than 3 items (cap impossible) the shares are equal.

| Metric       | Definition                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Market size  | Sum of daily volume (div/day) of its liquid items.                                                            |
| Loot value   | Volume-weighted average price of its liquid items (the "typical unit you would sell").                        |
| Items        | Number of liquid items (+ the top 3 by volume shown in the row).                                              |
| Trend 7 d    | `Σ w × N(d)/N(d−7)` / `Σ w`, divided by the market's median 7-day change (as Sell Now).                       |
| Outlook 14 d | `Σ w × R(d+14)/R(d)` / `Σ w` over items with reference data, divided by the reference market's median change. |
| Index chart  | Same weighted index, daily, for both leagues (base 1 = today), last 30 days and last league's next 30.        |

## 4. Verdicts

| Verdict         | Rule (defaults, tunable)                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **AVOID**       | Outlook ≤ ×0.85 vs market. (A Sell Now-style "falling" rule was dropped after the backtest, §6.) |
| **FARM & HOLD** | Outlook ≥ ×1.15 vs market (farm now, sell later — link to Speculation).                          |
| **FARM & SELL** | Otherwise, with market size ≥ 50 div/day (loot sells; sell as you go).                           |
| **THIN**        | Otherwise (market too small to sell much).                                                       |

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
replays the verdicts over the current league's stored history (days 7–N) and compares each
mechanic's index (same weights) 7 / 14 days later with the market's median move, per verdict.

Results (2026-10-24, median index 14 days later vs the market, share that beat it):

| Calls         | PoE 2 — FR vs RoA, days 7–48 | PoE 1 — Allflame vs Mirage, days 7–90 |
| ------------- | ---------------------------: | ------------------------------------: |
| All mechanics |           336 · ×1.03 · 56 % |                    924 · ×1.00 · 49 % |
| FARM & HOLD   |           149 · ×1.04 · 57 % |                    256 · ×1.04 · 52 % |
| FARM & SELL   |           140 · ×1.01 · 52 % |                    402 · ×0.98 · 48 % |
| THIN          |                            – |                    109 · ×1.06 · 63 % |
| AVOID         |            47 · ×1.07 · 60 % |                    157 · ×0.94 · 40 % |

Findings:

- **Weak signal.** In PoE 1 the verdicts order correctly (hold > sell > avoid, ±5 %); in PoE 2
  FARM & HOLD is only slightly ahead and AVOID did _better_ at 14 days (but not at 7 days:
  ×1.00, 49 %). PoE 2 has 8 mechanics × 42 days, highly correlated days: a small sample. The
  page says so; treat verdicts as hints and re-run each league.
- **Falling rule dropped**: mechanics falling ≥ 15 % in 7 days with a non-rising reference
  rebounded (PoE 1: 35 calls, ×1.07 vs the market), as short drops did for Sell Now. Off by
  default (`fallDrop: null`).
- Hold threshold 10 % / 25 % and avoid threshold 10 % / 25 % changed little; a 25 % weight
  cap helped PoE 1 (hold ×1.06) and hurt PoE 2 (×1.02); no cap was worse in PoE 1 (×0.97) →
  defaults kept (±15 %, 40 % cap).
- THIN is about liquidity, not direction (PoE 1: ×1.06).

## 7. League start

The page shows "waiting for data" until **day 7** of the current league (the 7-day trend needs
it; confidence is low before anyway). For PoE 1 3.30 (2026-11-13) that means from ~2026-11-20;
the mapping is updated for the 3.30 categories at launch.

## 8. Placement

Tool page only — no home-page widget (decided).
