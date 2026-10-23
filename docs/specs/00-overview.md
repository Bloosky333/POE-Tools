# POE-Tools — Application Spec (v1.0 — agreed)

> Status: **agreed**. Decisions are logged in [`open-questions.md`](./open-questions.md).

## 1. Vision

A web app that gathers small, focused, **decision-making** tools for Path of Exile 2
(first) and Path of Exile 1 (later). Tools are added incrementally; the shell (layout,
navigation, shared services such as league selection, exchange rates and price history)
is built once and reused. All code is written and maintained by Claude.

## 2. Scope of the first milestone (M1)

1. **App shell** — layout, navigation, game/league selector, settings.
2. **Tool #1 — Currency Speculation Advisor** (with positions tracker and budget
   basket) — see [`01-currency-speculation.md`](./01-currency-speculation.md).

Next tools are listed in [`02-backlog.md`](./02-backlog.md) and influence the shared
services designed now.

Out of scope for M1: user accounts, server-side alerts (Discord, e-mail), PoE 1.

## 3. App shell

### 3.1 Layout

- **Top bar**: app name, game switch (PoE 2 active; PoE 1 shown as "coming soon"),
  league selector (default: newest trade league — currently **Forbidden Rites**),
  data freshness ("prices updated 23 min ago"), theme toggle.
- **Side navigation** (collapsible; drawer on mobile): tools grouped by category
  (Economy, Crafting, …). Tools not available for the selected game are greyed out.
- **Home page**: grid of tool cards (name, one-line description, status
  _stable / beta / coming soon_), plus a compact "Top suggestions now" widget from
  tool #1.
- **Footer**: "Price data from poe.ninja", "Not affiliated with Grinding Gear Games",
  repo link.

### 3.2 Visual design (decided: clean & efficient)

- English only.
- Neutral, information-dense UI: system font stack, compact tables, tabular numbers,
  minimal decoration, no game-art backgrounds. Light/dark following OS, toggleable.
- Colour used only for meaning (gain / loss / warning) and always paired with a sign
  or icon (colour-blind safe).
- Keyboard friendly: `/` focuses search, sortable columns, URL reflects filters
  (shareable/bookmarkable views).

### 3.3 Tool plugin contract

```ts
interface ToolDefinition {
  id: string; // "currency-speculation"
  name: string;
  description: string;
  category: 'economy' | 'crafting' | 'misc';
  games: ('poe1' | 'poe2')[];
  status: 'stable' | 'beta' | 'coming-soon';
  route: string; // "/tools/currency-speculation"
  component: LazyComponent; // lazy-loaded
}
```

Adding a tool = a folder under `apps/web/src/tools/<id>` + one registry entry.

### 3.4 Shared services (designed for tool #1 and the backlog)

- **League service**: leagues per game with start/end dates, trade/event flags,
  "reference league" mapping.
- **Price service**: latest prices of all in-scope items, in divine.
- **Exchange-rate service**: divine ⇄ exalted ⇄ chaos rates (needed by tool #1 and
  backlog tools "flipping" and "cheapest currency path").
- **History service**: daily price series per item per league, lazy-loaded.
- **Local store**: settings, positions, alerts — `localStorage`, with JSON
  export/import (no accounts).

## 4. Architecture — static site + scheduled data job (DECIDED)

```
GitHub Actions (cron)                           Static hosting
 ├─ fetch poe.ninja PoE 2 economy overviews      SPA + /data/*.json
 ├─ daily: append snapshot → `data` branch       (no backend, no DB)
 ├─ compute speculation tables
 └─ build + deploy site with fresh JSON
```

- **poe.ninja usage policy**: the docs ask third-party clients to call the economy
  endpoints **from their own backend**, not from end-user machines, with caching, a
  descriptive ASCII `User-Agent` (`POE-Tools/1.0 (+repo URL)`) and controlled volume.
  The scheduled job _is_ our backend: one fetch per category per run, PoE 2 data
  refreshes ~hourly upstream so we never poll faster than that.
- Only the documented economy endpoints are used for recurring fetches. The one-time
  backfill of reference-league history is covered in tool spec §3.2.

### 4.1 Data storage (decided: Claude's best practice)

- **No hourly commits.** Hourly prices go straight into the deployed site artifact.
- **Daily snapshot** (first run after 00:00 UTC) is appended to history and committed
  to an orphan **`data` branch** (~1 small commit/day; `main` stays clean). This is
  our own long-term, source-independent history.
- Layout (versioned, zod-validated, gzip/brotli served):
  - `data/poe2/leagues.json` — leagues, start/end dates, reference mapping.
  - `data/poe2/<league>/current.json` — latest prices + exchange rates (+ fetchedAt).
  - `data/poe2/<league>/history/<category>.json` — `{ itemId: [[day, priceDiv, volume], …] }`.
  - `data/poe2/<league>/speculation.json` — pre-computed suggestions per mode/horizon.
- Startup payload target: < 300 KB compressed (current + speculation). History is
  loaded per item/category on demand.

### 4.2 Hosting (decided)

- Repo is **public** → **GitHub Pages** for the site, GitHub Actions for the data job
  (no minutes limit on public repos).
- Audience: **personal use for now** — no traffic protection, analytics or privacy
  notice needed. Being personal, the data job may later send the owner's own alerts
  (e.g. Discord webhook stored as a repo secret).

### 4.3 Stack (decided: Claude's choice)

- TypeScript (strict) everywhere, **pnpm** workspaces, Node 22.
- Web: React + Vite, Tailwind CSS, React Router, TanStack Query (data), TanStack Table
  (sort/filter/virtualised tables), Recharts (charts), zod (schemas).
- Data job: plain TypeScript run by Node in Actions, sharing schemas/types and the
  computation code with the web app.
- Tests: Vitest (unit, especially the suggestion engine), Playwright (smoke e2e).
- Lint/format: ESLint + Prettier; CI on every push.
- Layout: `apps/web`, `packages/data-job`, `packages/shared` (schemas, engine).

## 5. Non-functional requirements

- Respect poe.ninja policy (above); back-off and keep last good data on errors.
- Graceful degradation: stale/missing data shown with an explicit warning.
- Desktop first, usable on mobile.
- No personal data collected; positions stay in the browser.

## 6. Risks

- **poe.ninja API unstable** (no SLA/versioning): all parsing isolated in one adapter
  with zod validation; the job fails loudly (workflow error) instead of publishing
  garbage.
- **Endpoint shapes not yet verified**: poe.ninja was unreachable from the drafting
  environment (sandbox network policy — unrelated to poe.ninja's backend rule).
  First implementation step is a probe run from GitHub Actions to capture real
  responses as test fixtures.
- **Reference-league history backfill** (tool spec §3.2).
- Scheduled workflows are best-effort (delays of minutes) and are auto-disabled after
  60 days of repo inactivity — the job's own daily commits plus a monthly keep-alive
  mitigate this.

## 7. Milestones

| Milestone | Content                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| M0        | Specs agreed; repo scaffolding, CI; **probe workflow** capturing real poe.ninja responses |
| M1a       | Data job: hourly current prices, daily snapshots, reference-league backfill               |
| M1b       | App shell + tool registry + shared services, deployed                                     |
| M1c       | Speculation table, detail chart, suggestions                                              |
| M1d       | Positions tracker, budget basket, in-app alerts                                           |
| M2+       | Backlog tools (`02-backlog.md`)                                                           |
