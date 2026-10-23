# Open questions (to answer before implementation)

Answer inline (edit this file) or in chat; decisions will be moved into the specs and
recorded in the "Decision" line.

## Product / scope
- **Q1. Game coverage at launch**: PoE 1 only, PoE 2 only, or both? The economies differ
  (base currency, poe.ninja endpoints). Supporting both doubles the data work for tool #1.
  - Decision: ✅ **PoE 2 first.** PoE 1 later via the game switch.
- **Q2. Audience**: just you / friends, or a public site? Drives hosting, cost, polish,
  rate-limit concerns and whether we need a privacy notice.
  - Decision: _
- **Q3. Leagues**: Softcore trade challenge league only, or also Hardcore / Standard /
  SSF (SSF has no prices — irrelevant)? Private/event leagues?
  - Decision: _

## Architecture
- **Q4. Hosting**: Do you have a preference/budget (free tier like Vercel/Netlify +
  serverless, Cloudflare Workers + D1, a small VPS, a home server, Docker)? A static-only
  site is possible only if we pre-compute data in a scheduled job (e.g. GitHub Actions
  committing JSON) — that's actually a cheap, viable option. Which way?
  - Decision: ✅ **Static site + scheduled GitHub Actions job** publishing JSON (GitHub Pages).
- **Q5. Stack**: OK with TypeScript + React + Vite (+ Node backend, SQLite)? Any
  languages/frameworks you know or want to learn (Python, Vue, Svelte, Next.js…)?
  Who will maintain the code — you, or mostly Claude?
  - Decision: _

## Data
- **Q6. Previous-league history source**: OK to rely on poe.ninja data dumps for finished
  leagues (to verify availability, esp. PoE2), and to start collecting our own daily
  snapshots from now on? Are you aware of another source you'd prefer?
  - Decision: _
- **Q7. "Multiplied value" definition**: what exactly is the sell point?
  (a) fixed horizon h days later, (b) peak price in the rest of the league,
  (c) end of league, (d) all three as modes. And do you also want "best time to buy"
  (prices that are expected to *drop* first)?
  - Decision: ✅ **All modes, user-selectable**: fixed horizon (7/14/30 d), peak, end of league. ("Best time to buy" still open → Q19.)
- **Q8. Item categories**: only `Currency`, or also Fragments, Scarabs, Essences, Fossils,
  Oils, Divination cards, Omens, Catalysts, Delirium orbs…? (PoE2: Runes, Soul cores,
  Omens, etc.)
  - Decision: ✅ **Currency + common stackables** (see tool spec §3.1 for the PoE 2 list).
- **Q9. League start date**: OK to maintain a small config file (league name + start
  date) by hand each league, or must it be fully automatic?
  - Decision: _
- **Q10. Price unit**: compute in divine (PoE1) / exalted (PoE2) to neutralise chaos
  inflation? Or chaos? Toggle?
  - Decision: _
- **Q11. Number of reference leagues**: only the immediately previous league, or an
  average/median over the last N leagues (more robust, but mechanics change)?
  - Decision: _

## Features
- **Q12. Positions tracker**: do you want to record what you bought (qty, price) and see
  live profit? (Would need storage per user → localStorage is enough at first.)
  - Decision: _
- **Q13. Budget-aware suggestions**: e.g. "I have 50 div, what's the best basket?"
  taking liquidity into account — M1 or later?
  - Decision: _
- **Q14. Alerts**: notify when a currency hits a target price (browser/Discord)? Later?
  - Decision: _

## UX
- **Q15. Language(s)**: English only, or also French (or other)?
  - Decision: _
- **Q16. Look & feel**: dark PoE-inspired theme? Any existing site you like
  (poe.ninja, poe.trade, craftofexile…) as reference?
  - Decision: _
- **Q17. Next tools**: list the tools you already have in mind (even roughly) so the
  shell/navigation and shared services are designed for them (e.g. crafting cost
  calculator, flip finder, map/atlas strategy profit, divination card EV…).
  - Decision: _

## New questions raised by the decisions above
- **Q18. Data commits**: OK to commit hourly price snapshots to a dedicated `data`
  branch of this repo (repo grows ~ a few MB per league)? Or would you rather store
  data elsewhere (GitHub Releases assets, Cloudflare R2, …)?
  - Decision: _
- **Q19. Buy timing**: should the tool also say "wait, it usually drops further before
  rising" (i.e. suggest the best buy day, not just "buy now")?
  - Decision: _
- **Q20. PoE 2 reference data**: if no previous-league history is obtainable for PoE 2,
  is it acceptable that the tool shows only current prices/trends during the first league
  while it collects its own history? Do you know of any PoE 2 history source
  (poe.ninja dumps, poe2scout, your own records)?
  - Decision: _
- **Q21. Current PoE 2 league**: which league is current right now and its start date
  (to seed the config)? Should we also track Hardcore?
  - Decision: _
