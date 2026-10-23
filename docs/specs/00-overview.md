# POE-Tools — Application Spec (DRAFT v0.1)

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
- **Top bar**: app name/logo, game switch (PoE 1 / PoE 2) **[OPEN Q1]**, league
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
- **Settings**: preferred game, league, price unit (chaos/divine/exalted),
  theme (dark default) — persisted in `localStorage`.

## 4. Architecture [ASSUMPTION — OPEN Q4, Q5]

```
Browser (SPA)  ──►  Backend API (cache + compute)  ──►  poe.ninja economy API
                         │
                         └──► Historical store (previous-league daily prices)
```

Why a backend rather than calling poe.ninja from the browser:
- poe.ninja's docs state only the **economy overview endpoints** are supported, with
  **no SLA / no versioning**, and clients making excessive requests **get blocked**.
  One server-side cache shared by all users keeps us well-behaved.
- Browser calls are likely blocked by CORS anyway.
- Previous-league history must be ingested and stored once (it doesn't change), and
  the "time-aligned multiplier" computation is better done server-side.

Proposed stack **[ASSUMPTION — OPEN Q5]**:
- Frontend: TypeScript + React + Vite, Tailwind for styling, TanStack Query for
  data fetching, Recharts (or similar) for price charts.
- Backend: TypeScript (Node, Fastify/Hono) to share types with the frontend.
- Storage: SQLite (single file) for historical prices and snapshots.
- Scheduled job: refresh current prices every ~1 h (poe.ninja refreshes roughly hourly).
- Monorepo: `apps/web`, `apps/api`, `packages/shared`.

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
- PoE2 economy differs from PoE1 (currency exchange based, different base currency).
- Note: poe.ninja was not reachable from the environment used to draft this spec, so
  exact response shapes still need to be verified against the live API.

## 7. Milestones (proposal)
| Milestone | Content |
|---|---|
| M0 | Specs agreed, repo scaffolding, CI (lint, typecheck, tests) |
| M1a | App shell + tool registry + league/price services |
| M1b | Historical data ingestion for previous league(s) |
| M1c | Currency Speculation Advisor UI + scoring |
| M2+ | Next tools (backlog to be defined) |
