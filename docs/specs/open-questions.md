# Decisions log & open questions

## Decided

| #      | Topic                            | Decision                                                                                                                                                       |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1     | Game                             | **PoE 2 first**; PoE 1 later via the game switch.                                                                                                              |
| Q3/Q21 | Leagues                          | Softcore trade. Current: **Forbidden Rites** (0.5.5, start 2026-09-04 20:00 UTC). Reference: **Runes of Aldur** (0.5.0, start 2026-05-29). Hardcore not in M1. |
| Q4     | Architecture                     | **Static site + scheduled job** (no server). Hosting provider → Q22.                                                                                           |
| Q5     | Stack                            | Claude's choice: TypeScript, React + Vite, Tailwind, TanStack, Recharts, zod, Vitest, pnpm monorepo.                                                           |
| Q6/Q20 | History                          | Previous-league data exists (5th league). Source decided by M0 probe: dumps → one-time throttled backfill → alt source; own daily snapshots from now on.       |
| Q7     | Sell point                       | All modes: fixed horizon (7/14/30 d), peak, end of league.                                                                                                     |
| Q8     | Categories                       | Currency + common stackables.                                                                                                                                  |
| Q9     | League dates                     | `leagues.json`, maintained per league (+ auto-detect where possible).                                                                                          |
| Q10    | Unit                             | **Divine only.**                                                                                                                                               |
| Q11    | Reference leagues                | **Only the immediately previous league** (older economies irrelevant); manual override available.                                                              |
| Q12    | Positions                        | M1, localStorage + export/import.                                                                                                                              |
| Q13    | Budget basket                    | M1.                                                                                                                                                            |
| Q14    | Alerts                           | M1 in-app/browser notifications; Discord later.                                                                                                                |
| Q15    | Language                         | English only.                                                                                                                                                  |
| Q16    | Theme                            | Clean, efficient, information-dense; light/dark.                                                                                                               |
| Q17    | Next tools                       | Flipping suggester, cheapest-currency path, crafting recipes → `02-backlog.md`.                                                                                |
| Q18    | Data storage                     | No hourly commits; daily snapshots on orphan `data` branch; hourly data in deployed artifact.                                                                  |
| Q2     | Audience                         | **Personal use** for now.                                                                                                                                      |
| Q22    | Hosting                          | Repo made **public** → GitHub Pages + GitHub Actions.                                                                                                          |
| Q23    | Thresholds                       | Defaults OK: BUY NOW ≥ ×1.3, WAIT if ≥ 10 % dip expected first, SELL when < 5 % upside left; tunable.                                                          |
| Q24    | Runes of Aldur as current league | **No** — reference only.                                                                                                                                       |
| Q19    | Suggestions                      | Must-have: BUY NOW / WAIT / AVOID / NEUTRAL, HOLD / SELL for positions, with confidence.                                                                       |

## Implementation decisions (M1c)

| Topic            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History price    | Volume-weighted average paid over all currency pairs (see `03-poe-ninja-api.md`).                                                                                                                                                                                                                                                                                                                                                                              |
| Confidence       | `100 × phase × (0.4 similarity + 0.35 liquidity + 0.25 completeness)`; similarity = correlation of daily log-returns over the last 14 days (0.5 when < 5 days); liquidity saturates at 50 div/day; phase 0.5 on days 0–3.                                                                                                                                                                                                                                      |
| Default filters  | Min volume 5 div/day (also required for BUY NOW), min price 0.05 div, hold 14 days.                                                                                                                                                                                                                                                                                                                                                                            |
| Price level      | Expected multiplier `M_eff = M × max(1, π)^−β` (spec 01 §4.2b), premium `π` = item price vs reference price × market factor (median N/R of liquid items). Only premiums damp (β = 1); AVOID stays on the raw curve. Backtest FR vs RoA days 7–35, 14-day hold (`pnpm --filter @poe-tools/data-job backtest`): BUY NOW calls rose 81 % (median ×1.25) vs 78 % (×1.21) without. Premium alone does not predict losses (×1.09, like NEUTRAL). Re-tune per league. |
| Known limitation | Market-wide moves of the reference league (e.g. Runes of Aldur day ~55: divine +20% vs chaos, most items −10% in divine) drive WAIT/BUY for many items at once. Possible refinement: compare items against a market index.                                                                                                                                                                                                                                     |

## Tool #2 — Cheapest Currency (spec `04-cheapest-currency.md`)

| #   | Topic        | Decision                                                                                                      |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| Q25 | Core job     | **Single-item lookup**: item + quantity → which currency to pay with.                                         |
| Q26 | Freshness    | Per-pair rates **daily** (existing details pass) + busiest pair **hourly** from the overview; leg ages shown. |
| Q27 | On-demand    | **No** instant refresh (no proxy, no workflow trigger) — browser never calls poe.ninja.                       |
| Q28 | Coverage     | Illiquid items without details: shown with **partial data** (busiest pair + blended price) and a label.       |
| Q29 | Paths        | **Direct payment only** (divine / exalted / chaos); no conversion step, no multi-hop.                         |
| Q30 | Inputs       | Item + quantity (no wallet).                                                                                  |
| Q31 | Verdict      | Recommend only if ≥ 5 % cheaper than the next pair **and** that pair trades ≥ 1 div/day; tunable.             |
| Q32 | Extras       | Recent lookups / favourites. No spread table, no chart, **no home-page widget**.                              |
| Q33 | Item scope   | All 14 exchange categories.                                                                                   |
| Q34 | Pair history | Store daily per-pair CSV on the `data` branch (not used by v1 UI).                                            |
| Q35 | Rounding     | Whole units: round paid amount up, show waste and a "same price buys N'" hint; verdict uses real costs.       |

### Implementation decisions (M2a)

| Topic      | Decision                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pair data  | Separate `pairs.json` (not in `current.json`, keeps the startup payload). Daily quotes older than 7 days are dropped.                                |
| Pair store | `pairs/<ExchangeType>.csv` filled by the existing daily details pass of selectable leagues; reference leagues only get it on a backfill re-run.      |
| Open check | Pairs differ 5–12× for 10+ days (exalted cheapest) — verify in game that these rates are payable before relying on the tool (`03-poe-ninja-api.md`). |

## Currency flipping (M2, draft — `04-currency-flipping.md`)

| #   | Topic       | Decision                                                                                                                                                 |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Flip types  | Both: spread (one market) and cross-pair (hub A → item → hub B → A).                                                                                     |
| F2  | Data source | GGG public currency-exchange feed (hourly digests), data job only; no OAuth app. poe.ninja kept for names / icons.                                       |
| F3  | Freshness   | Daily data is useless; the hourly feed (1–2 h old when shown) is accepted as a trial.                                                                    |
| F4  | Spread      | Hourly ratio range is a heuristic: count hours with trades only, rank only recurring spreads (last 24 h).                                                |
| F5  | Cross-pair  | Loops through divine / exalted / chaos only; no item-to-item cycles.                                                                                     |
| F6  | Markets     | Only markets against divine, exalted or chaos.                                                                                                           |
| F7  | Units       | Divine-only rule lifted for this tool: ratios in their own currencies; profit in %.                                                                      |
| F8  | Gold        | Wanted later: gold per 1 div of profit with a low / normal / high indicator. **Deferred** — not in v1 (fee unverified).                                  |
| F9  | Volume      | Min-volume selector in units of the item traded (24 h), on every leg; plus a divine-value filter (F16).                                                  |
| F10 | Scope       | Every item on the currency exchange; no budget, no flip log for now.                                                                                     |
| F11 | Priority    | First backlog tool, before cheapest currency path.                                                                                                       |
| F12 | Prices      | Margins use the volume-weighted average price of each leg (revised after the probe; optimistic ends had no signal). Best case shown in the detail sheet. |
| F13 | Outliers    | Hours with high/low > 3 are excluded from recurrence.                                                                                                    |
| F14 | Columns     | Margin % and volume in separate columns, no combined score; default sort by margin.                                                                      |
| F15 | Spread      | Kept in v1 as a heuristic ranked on recurrence (the feed has no volume per ratio).                                                                       |
| F16 | Value       | Min divine value traded per leg (24 h), default 120 div, tunable.                                                                                        |

## Sell Now (spec `06-sell-now.md`)

| Topic       | Decision                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope       | Whole market in v1; the player's own stash later.                                                                                                        |
| Trigger     | Flag when either signal fires (Peak or Falling), with the reason shown.                                                                                  |
| Peak        | Last league peaks around today (or within 7 days → SELL SOON) and then falls ≥ 15 % over 14 days.                                                        |
| Falling     | First agreed as 1 / 3 / 7-day drops; backtest showed short drops rebound → **7-day drop ≥ 15 % confirmed by a non-rising reference** (decided after it). |
| Rise guard  | First agreed ("still rising ≥ 10 % in 3 days → SELL SOON"); backtest showed no gain → **dropped**, trend shown in the row instead.                       |
| Ranking     | Expected loss × confidence.                                                                                                                              |
| Integration | Separate tool, engine next to speculation in `packages/shared`, reusing its helpers.                                                                     |
| Alerts      | None in v1.                                                                                                                                              |
| Tuning      | Defaults validated by `backtest-sell` (spec 06 §5); re-run per league.                                                                                   |

## PoE 1 (`07-poe1.md`)

| #   | Topic      | Decision                                                                                                 |
| --- | ---------- | -------------------------------------------------------------------------------------------------------- |
| P1  | Unit       | PoE 1 prices in **chaos**, divine value shown alongside; "divine only" (Q10) stays for PoE 2.            |
| P2  | Item scope | PoE 1 **exchange items only** (poe.ninja PoE 1 exchange categories); stash items (uniques, gems…) later. |
| P3  | Timing     | **Ready for the 3.30 launch** (2026-11-13), 3.29 Curse of the Allflame as reference, backfilled first.   |
| P4  | Tools      | Speculation, Flipping, Cheapest Currency and Sell Now; Crafting Recipes follows its PoE 2 spec.          |
| P5  | Reference  | Same rule as Q11: only the previous league (3.30 → 3.29); 3.28 Mirage only for backtests.                |
| P6  | Feed       | Public PoE 1 feed exists (`web.poecdn.com/api/currency-exchange/{hour}`): flipping without OAuth.        |
| P7  | Hubs       | PoE 1 hubs = chaos + divine (exalted in 7 markets of ~2,200 over 3 h); also the cheapest-currency pairs. |
| P8  | 3.30 name  | Unknown until ExileCon: entry `poe1-3-30` resolves poe.ninja's new challenge league at launch.           |
| P9  | Cheapest   | Cheapest Currency page built with the PoE 1 port, for both games (status beta).                          |

## Still open

- Currency flipping: recurrence thresholds (calibrate on data), gold (deferred), base item id mapping, Gemcutter's Prism in-game check — see
  `04-currency-flipping.md` §9.
- PoE 1: chaos thresholds (starting values), 3.30 name after ExileCon — see `07-poe1.md` §9.
- **Stash import for Sell Now**: reading the player's stash needs GGG OAuth (account
  scopes), which a static site without a backend cannot hold safely. Options: manual entry,
  pasted stash export, or a backend later.
