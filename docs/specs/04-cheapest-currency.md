# Tool #2 — Cheapest Currency (v1.0 — agreed)

Game: **PoE 2**. Tool id: `cheapest-currency` (already registered as _coming soon_).
Category: economy. Decisions are logged in [`open-questions.md`](./open-questions.md) (Q25–Q35).

## 1. Goal

Answer one question quickly: **"I want N of item X from the currency exchange — should I
pay in divine, exalted or chaos?"**

Each exchange item trades in separate markets against divine, exalted and chaos, and
their rates disagree (e.g. Artificer's Orb, 2026-10-24: the three pairs, converted to
divine at the core cross rates, differ by several times). The tool compares the three
**direct** payments and recommends one only when the difference is meaningful.

Out of scope (v1): conversion paths (convert first, then pay), multi-hop or
non-core intermediate currencies, wallet/affordability, order-book depth/slippage,
market-wide spread table, price charts, home-page widget, alerts, PoE 1.

## 2. Data

### 2.1 Sources

- **Per-pair rates** (`rate`, `volumePrimaryValue` for pairs divine/exalted/chaos) come
  from the exchange **details** route, already fetched once per UTC day for every liquid
  item (~270 items, `00-overview.md` §4.1). **No extra poe.ninja requests.**
- **Busiest pair, hourly**: the overview's `maxVolumeCurrency` / `maxVolumeRate`
  refreshes one leg per item every hour; it overrides that pair's daily rate when newer.
- **Cross rates**: `core.rates` of the hourly overview (exalted/chaos per divine).
- **No on-demand refresh**: the browser never calls poe.ninja, and a proxy/workflow
  trigger is not worth the infra. Each leg displays its own age instead.
- Rate directions are verified (`03-poe-ninja-api.md`): details `rate` = pay currency per
  item, overview `maxVolumeRate` = its inverse. The same page records how much (and how
  persistently) pairs disagree — to be validated in game before trusting a verdict.

### 2.2 Coverage

- All 14 exchange categories (~630 items), searchable.
- Items without daily details (illiquid) are shown with **partial data**: busiest pair +
  blended price only, labelled "other pairs unknown — low liquidity".

### 2.3 Published / stored files

- Site data: `poe2/<league>/pairs.json` (separate file, loaded by this tool only; ~25 KB
  gzipped), schema `pairsFileSchema` in `packages/shared/src/site-data.ts`:
  `{ items: { itemId: { divine?: {rate, volume, asOf, source}, exalted?: …, chaos?: … } } }`.
  `rate` = **units of pay currency per item**; `volume` = that pair's daily volume in
  divine (`null` when only the hourly pair is known); `source` = `daily` (latest completed
  day ≤ 7 days old, `asOf` = end of that day) or `hourly` (busiest pair, `asOf` = fetch
  time; keeps the daily volume).
- `data` branch: daily per-pair history
  `poe2/<league>/pairs/<ExchangeType>.csv` — `date,item,pair,rate,volume_div`
  (not used by the v1 UI; enables a later chart/backtest of gap persistence).

## 3. Computation (`packages/shared`, Vitest-covered)

For item X, quantity N, pay currency C ∈ {divine, exalted, chaos} with rate `r_C`
(C per item) and cross rate `x_C` (C per divine, `x_divine = 1`):

1. **Whole units**: the exchange trades whole units on both sides, so the amount paid is
   `pay_C = ceil(N × r_C)` units of C; waste = `pay_C − N × r_C`.
2. **Real cost in divine**: `cost_C = pay_C / x_C`; effective unit price `cost_C / N`.
3. **Clean quantity hint**: per currency, the largest N' ≥ N that `pay_C` still buys
   (`floor(pay_C / r_C)`), i.e. "for the same 1 div you can get 72".
4. **Verdict**: let C* be the cheapest pair by `cost_C`. Recommend "pay in C*" only if
   - `cost_C*` beats the next cheapest by **≥ 5 %**, and
   - pair C\* traded **≥ 1 div/day**.

   Otherwise: "no meaningful difference". Both thresholds are tunable in settings.
   Pairs with no data are excluded; a single known pair yields no verdict.

## 4. UI

- Route `/tools/cheapest-currency`; built from `apps/web/src/ui/` per
  `docs/ui-guidelines.md`.
- **Inputs**: item search (`/` focuses, category filter, icons), quantity (default 1).
  URL reflects item + quantity (shareable).
- **Result card**: verdict line (pay with C\*, saving vs next and vs worst), then one row
  per pair: native amount to hand over, cost in divine, effective unit price, waste,
  clean-quantity hint, daily volume, data age. Low-volume or stale legs carry a warning
  icon. Partial-data items show the low-liquidity label.
- **Recent & favourites**: localStorage list (recent lookups, star to pin); one click
  re-runs the lookup. Included in the app's JSON export/import.
- Footer line: "Rates as of …" (oldest leg used).

## 5. Milestone

| Step | Content                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| M2a  | Data job: confirm `rate` direction, publish per-pair rates, daily per-pair CSV |
| M2b  | Shared computation + tests; tool page (lookup, result card, recent/favourites) |
