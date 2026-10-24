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

| Topic            | Decision                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History price    | Volume-weighted average paid over all currency pairs (see `03-poe-ninja-api.md`).                                                                                                                                          |
| Confidence       | `100 × phase × (0.4 similarity + 0.35 liquidity + 0.25 completeness)`; similarity = correlation of daily log-returns over the last 14 days (0.5 when < 5 days); liquidity saturates at 50 div/day; phase 0.5 on days 0–3.  |
| Default filters  | Min volume 5 div/day (also required for BUY NOW), min price 0.05 div, hold 14 days.                                                                                                                                        |
| Known limitation | Market-wide moves of the reference league (e.g. Runes of Aldur day ~55: divine +20% vs chaos, most items −10% in divine) drive WAIT/BUY for many items at once. Possible refinement: compare items against a market index. |

## Still open

None — specs agreed. New questions will be added here as implementation progresses.
