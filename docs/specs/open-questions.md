# Decisions log & open questions

## Decided
| # | Topic | Decision |
|---|---|---|
| Q1 | Game | **PoE 2 first**; PoE 1 later via the game switch. |
| Q3/Q21 | Leagues | Softcore trade. Current: **Forbidden Rites** (0.5.5, start 2026-09-04 20:00 UTC). Reference: **Runes of Aldur** (0.5.0, start 2026-05-29). Hardcore not in M1. |
| Q4 | Architecture | **Static site + scheduled job** (no server). Hosting provider → Q22. |
| Q5 | Stack | Claude's choice: TypeScript, React + Vite, Tailwind, TanStack, Recharts, zod, Vitest, pnpm monorepo. |
| Q6/Q20 | History | Previous-league data exists (5th league). Source decided by M0 probe: dumps → one-time throttled backfill → alt source; own daily snapshots from now on. |
| Q7 | Sell point | All modes: fixed horizon (7/14/30 d), peak, end of league. |
| Q8 | Categories | Currency + common stackables. |
| Q9 | League dates | `leagues.json`, maintained per league (+ auto-detect where possible). |
| Q10 | Unit | **Divine only.** |
| Q11 | Reference leagues | **Only the immediately previous league** (older economies irrelevant); manual override available. |
| Q12 | Positions | M1, localStorage + export/import. |
| Q13 | Budget basket | M1. |
| Q14 | Alerts | M1 in-app/browser notifications; Discord later. |
| Q15 | Language | English only. |
| Q16 | Theme | Clean, efficient, information-dense; light/dark. |
| Q17 | Next tools | Flipping suggester, cheapest-currency path, crafting recipes → `02-backlog.md`. |
| Q18 | Data storage | No hourly commits; daily snapshots on orphan `data` branch; hourly data in deployed artifact. |
| Q19 | Suggestions | Must-have: BUY NOW / WAIT / AVOID / NEUTRAL, HOLD / SELL for positions, with confidence. |

## Still open
- **Q2. Audience**: just you (and friends), or a public site? Impacts hosting limits,
  whether we need to protect against traffic, and if the data job can be personal
  (e.g. your own Discord alerts).
  - Decision: _
- **Q22. Hosting (repo is private)**: (a) make repo public → free GitHub Pages +
  unlimited Actions minutes *(recommended)*; (b) stay private + Cloudflare Pages + job
  every 2 h; (c) stay private + Cloudflare Workers cron + Pages.
  - Decision: _
- **Q23. Action thresholds**: are the defaults OK — BUY NOW at ≥ ×1.3, WAIT if a ≥ 10 %
  dip is expected first, SELL when < 5 % upside remains? (All tunable in settings.)
  - Decision: _
- **Q24. Runes of Aldur as a target league**: you might also trade in Runes of Aldur
  itself. Should it be selectable as a *current* league (its reference would then be
  0.4)?
  - Decision: _
