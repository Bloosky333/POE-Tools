# POE-Tools — Application Spec (DRAFT v0.2)

> Status: **draft, under discussion**. Items marked **[OPEN Qx]** are unresolved and
> tracked in [`open-questions.md`](./open-questions.md). Items marked **[ASSUMPTION]**
> are my proposed defaults until you say otherwise.

## 1. Vision

A web app that gathers small, focused tools for Path of Exile 1 and/or Path of Exile 2
in one place. Tools are added incrementally; the shell (layout, navigation, shared
services such as league selection and price data) is built once and reused.

## 2. Scope of the first milestone (M1)

1. **App shell** — layout, navigation to tools, game/league selector, settings.
2. **Tool #1 — Currency Speculation Advisor** — see
   [`01-currency-speculation.md`](./01-currency-speculation.md).

Out of scope for M1: user accounts, notifications, any tool other than #1.

## 3. App shell

### 3.1 Layout
- **Top bar**: app name/logo, game switch (PoE 2 / PoE 1 — **PoE 2 only in M1**, the
  switch is built but PoE 1 is shown as "coming soon"), league
  selector (current challenge league by default), data freshness indicator
  ("prices updated 23 min ago").
- **Side navigation** (collapsible; becomes a drawer on mobile): list of tools, grouped
  by category (Economy, Crafting, Builds, …). Tools not available for the selected game
  are hidden or greyed out.
- **Home page**: grid of tool cards (name, short description, game badge, status:
  *stable / beta / coming soon*).
- **Footer**: data attribution ("Price data from poe.ninja"), disclaimer
  ("Not affiliated with Grinding Gear Games"), link to repo.

### 3.2 Tool plugin contract
Each tool is a self-contained module registered in a single registry:

```ts
interface ToolDefinition {
  id: string;                 // "currency-speculation"
  name: string;
  description: string;
  category: "economy" | "crafting" | "builds" | "misc";
  games: ("poe1" | "poe2")[];
  status: "stable" | "beta" | "coming-soon";
  route: string;              // "/tools/currency-speculation"
  component: LazyComponent;   // lazy-loaded so tools don't bloat the shell
}
```

Adding a tool = adding a folder + one registry entry. No shell changes.

### 3.3 Shared services
- **League service**: list of leagues per game, current league, league start date.
- **Price service**: fetches and caches poe.ninja data (via our backend, see §4).
- **Settings**: preferred game, league, price unit (exalted/divine for PoE 2;
  chaos/divine for PoE 1),
  theme (dark default) — persisted in `localStorage`.

## 4. Architecture — static site + scheduled data job (DECIDED)

```
GitHub Actions (cron, hourly)                 GitHub Pages (static SPA)
 ├─ fetch poe.ninja economy overviews  ──►     reads /data/*.json
 ├─ append daily snapshot (history)            (no backend, no DB)
 ├─ compute speculation tables
 └─ publish JSON to the `data` branch / Pages
```

- **No running server.** A scheduled GitHub Actions workflow is the only thing that
  talks to poe.ninja: ~1 request per category per hour, descriptive `User-Agent`,
  back-off on errors. Users' browsers never hit poe.ninja → no CORS issue, no risk of
  being blocked for excessive use.
- **Data layout** (versioned JSON, schema-validated):
  - `data/{game}/leagues.json` — league list + start/end dates.
  - `data/{game}/{league}/current.json` — latest prices (all in-scope categories).
  - `data/{game}/{league}/history/{category}.json` — one point per item per day.
  - `data/{game}/{league}/speculation.json` — pre-computed multipliers per
    (reference league, mode, horizon) so the UI only filters/sorts.
- **Where data is stored**: committed to a dedicated `data` branch (keeps `main` history
  clean; hourly commits would otherwise flood it) and deployed to Pages together with
  the SPA build. Daily snapshots are append-only and become our own long-term history.
- **Trade-offs accepted**: data is at most ~1 h stale; any computation not pre-computed
  must run in the browser (fine at this data size: a few hundred items × ~120 days).

Stack **[ASSUMPTION — OPEN Q5]**:
- TypeScript everywhere. Frontend: React + Vite, Tailwind, TanStack Query, Recharts
  (or similar). Router: hash or base-path aware (GitHub Pages).
- Data job: TypeScript script run with Node in Actions, sharing types/zod schemas with
  the frontend.
- Monorepo: `apps/web`, `packages/data-job`, `packages/shared`.

## 5. Non-functional requirements
- Respect poe.ninja: ≤ 1 request per endpoint per refresh cycle, cached server-side,
  descriptive `User-Agent`, back-off on errors.
- Works on desktop first, usable on mobile.
- Graceful degradation: if poe.ninja is down, show last cached data with a warning.
- No personal data collected in M1.

## 6. Constraints & known risks
- **poe.ninja API is not stable** — breaking changes may happen without notice.
  Isolate all poe.ninja parsing in one adapter module with schema validation (zod)
  so breakage is detected and contained.
- **Historical data source** for previous leagues is the biggest unknown
  (see tool spec §3 and **[OPEN Q6]**).
- PoE 2 economy (first target) is currency-exchange based, priced in exalted/divine, and
  has **few past leagues** — the reference history may be thin (see tool spec §3.2).
- GitHub Actions cron is best-effort (runs can be delayed by minutes); scheduled
  workflows are disabled after 60 days without repo activity — needs a keep-alive or
  periodic commits (the data commits themselves count only if on the default branch
  **[OPEN Q18]**).
- Note: poe.ninja was not reachable from the environment used to draft this spec, so
  exact response shapes still need to be verified against the live API.

## 7. Milestones (proposal)
| Milestone | Content |
|---|---|
| M0 | Specs agreed, repo scaffolding, CI (lint, typecheck, tests) |
| M1a | App shell + tool registry + league/price services, deployed to GitHub Pages |
| M1b | Data job: snapshots of current league (start ASAP) + ingestion of previous league(s) |
| M1c | Currency Speculation Advisor UI + scoring |
| M2+ | Next tools (backlog to be defined) |
