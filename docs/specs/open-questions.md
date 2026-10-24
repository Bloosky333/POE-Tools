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

## Still open

- Currency flipping: recurrence thresholds (calibrate on data), gold (deferred), base item id mapping, Gemcutter's Prism in-game check — see
  `04-currency-flipping.md` §9.
