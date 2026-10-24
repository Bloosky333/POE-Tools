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

### 4.1 Data storage (decided: Claude's best practice — implemented in M1a)

- **Hourly** (`.github/workflows/data.yml`, cron `:17`): current overviews of the
  selectable league (14 requests) → `current.json`, deployed with the site, not committed.
- **Once per league**: full history backfill through the exchange details route
  (items with ≥ 2 div daily volume).
- **Once per UTC day** (first run after midnight), current league only: the details
  history of every liquid item is re-fetched (~270 throttled requests, ≈ 7 min) so each
  item's series has a single, consistent source; items without details get yesterday's
  overview snapshot. Committed to the orphan **`data` branch** (1 commit/day; `main`
  stays clean).
- Store (`data` branch), append-friendly CSV sorted by date:
  - `poe2/<league>/history/<ExchangeType>.csv` — `date,item,price_div,volume_div,source`
  - `poe2/<league>/fx.csv` — `date,exalted_per_div,chaos_per_div`
  - `poe2/<league>/meta.json` — backfill state, last closed date, items with history.
  - `icons/<hash>-<Name>.png` — item icons, downloaded once from GGG's CDN
    (`web.poecdn.com`, fallback poe.ninja) and served by the site, so browsers never call
    poe.ninja.
- Site data (`/data/`, schemas in `packages/shared/src/site-data.ts`):
  - `poe2/leagues.json`
  - `poe2/<league>/current.json` — latest prices + rates + `fetchedAt`.
  - `poe2/<league>/history/<ExchangeType>.json` — `{ item: [[day, priceDiv, volumeDiv]] }`.
  - `poe2/<league>/fx.json` — `[[day, exaltedPerDiv, chaosPerDiv]]`.
- Startup payload target: < 300 KB compressed (current + speculation). History is
  loaded per category on demand.

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
- Endpoint shapes verified by the M0 probe (`03-poe-ninja-api.md`). History relies on
  an undocumented economy route; own snapshots are the fallback.
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
