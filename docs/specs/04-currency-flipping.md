# Tool #2 — Currency Flipping (v0.2 — draft, under review)

Game: **PoE 2**. Status: draft — decisions so far are logged in
[`open-questions.md`](./open-questions.md) (F-series); open points are listed in §9.

## 1. Goal

Show which trades on the in-game **currency exchange** make a margin right now, with the
exact ratios to type in-game. Two kinds of flip:

- **Spread flip** — one market (e.g. exalted ↔ Omen of X): buy the item at the low end of
  the recent ratio range, sell it at the high end.
- **Cross-pair flip** — buy an item with one hub currency, sell it for another, convert
  back: e.g. pay exalted for X, sell X for chaos, sell chaos for exalted.

Hub currencies: **divine, exalted, chaos** only. Markets between two non-hub items
(e.g. Omen ↔ Omen) are ignored.

Out of scope for v1: budget allocation, flip log / tracking, item-to-item cycles.

## 2. Units

- The global "divine only" rule (Q10) is **lifted for this tool**: orders are shown as the
  in-game ratios in their own currencies (e.g. "pay 3 ex : get 1 X", "sell 1 X : get 25 c").
- **Profit is a percentage** of the capital put in (it does not depend on quantity).
- Divine is used only to make volumes (and later gold costs) comparable (§5).

## 3. Data source — GGG currency exchange feed

`GET https://web.poecdn.com/api/currency-exchange/poe2/{hourEpoch}` — official, public,
no OAuth (used the same way by poe2scout). Facts below are from third-party code and notes;
they are to be confirmed by the probe (§8, step 1).

- One response = **one complete past hour**, every market of every league
  (~2–3k markets; ~2k for Forbidden Rites). The current hour is never available, so data is
  **1–2 h old** when shown (digest published ~5 min after the hour; our job runs at `:17`).
- Per market: `league`, `market_id` (`baseItemId|baseItemId`), `market_pair`,
  `volume_traded`, `lowest_stock`, `highest_stock`, `lowest_ratio`, `highest_ratio` —
  dictionaries keyed by base item id (`Metadata/Items/Currency/...`), integer values.
- Ratios are integer pairs, i.e. what players type in-game. `lowest_*` / `highest_*` are
  the **range within the hour**, not a live order book.
- Markets can show stock with zero trades. Private leagues (`... (PL12345)`) and Hardcore
  are excluded.
- History is available by epoch (back to Dec 2024; GGG may prune old history).

Called **only from the data job**, with the project `USER_AGENT`, one request per run
(plus a throttled one-time backfill of up to 24 hours when the rolling window is missing).

poe.ninja stays the source for divine prices (volume in divine, later gold per div).

### 3.1 Item identity

The feed uses base item ids; names/icons/categories come from poe.ninja. A mapping table
`baseItemId → poe.ninja id` is needed (source to be chosen at implementation: e.g. a RePoE
PoE 2 `base_items` export, refreshed per league). Unmapped ids are logged and skipped.

## 4. Data job & storage

- Hourly run (existing `data.yml`): fetch the newest complete hour, keep only the current
  league and markets with at least one hub currency.
- **Rolling window of the last 24 hours** per market, published as site data
  (`/data/poe2/<league>/exchange-window.json`). Next run reads the window back from the
  deployed site (no hourly commits, consistent with Q18); if missing, rebuild it from the
  feed (≤ 24 throttled requests).
- Computed table `/data/poe2/<league>/flips.json` (schema in `packages/shared`).

## 5. Engine (`packages/shared`, unit-tested)

Notation: for a market hub `H` ↔ item `X`, a ratio is converted to `p` = units of `H` per
1 `X`. Each hour gives `p_low`, `p_high` (from the ratio range).
Hub conversion rates come from the hub ↔ hub markets of the same hour (same source, same
hour → no cross-source drift).

### 5.1 Spread flip (one market)

`margin = p_high / p_low − 1` for the hour, only if the market traded that hour
(`volume_traded > 0` on both sides).

### 5.2 Cross-pair flip (hub A → X → hub B → A)

`margin = p_B(X) · rate(B→A) / p_A(X) − 1`, **optimistic** on every leg (decided): buy X at
`p_low` in the A market, sell X at `p_high` in the B market, convert B → A at the most
favourable end of the B ↔ A range. It is an upper bound, which the recurrence filter
(§5.3) and the per-leg ranges in the detail sheet put into context. All 6 ordered hub pairs
are evaluated per item; the best direction is kept.

### 5.3 Recurrence (confidence)

`recurrence = share of the last 24 hours where the flip had margin ≥ minMargin`
(starting value 3 %) **and** all legs traded. Only flips with recurrence ≥ 25 % (starting
value) are ranked; the latest hour alone is never enough. Both thresholds are **not decided**:
they are tunable in the UI and will be calibrated on real feed data (probe fixtures, then the
first days of the rolling window). Shown as a 0–100 `ScoreMeter`.

### 5.4 Volume / capacity

- Volume is in **units of the flipped item traded over the last 24 h** (a 5000-div item
  traded once is not flippable, whatever its margin).
- Capacity of a cross-pair flip = the minimum over its legs (in units of X).
- The min-volume selector filters on units; the divine value of that volume is shown as
  context.

### 5.5 Gold cost — deferred (not in v1)

Parked until the fee can be checked in-game; v1 ships without the gold column. Notes kept
for later:

The exchange charges gold when an order is placed. No official formula is published; the
PoE 2 wiki lists a fixed gold cost per item (e.g. exalted 120, divine 800, mirror 25,000).
v1 model (to be confirmed, §9):

`gold(order) = goldCost(item received) × quantity received`

- `gold per div = total gold of one cycle (all legs) / profit of that cycle in divine`,
  independent of quantity under this model.
- Shown with a tone + word, relative to the current table: **low** (≤ 0.5 × median of the
  listed flips, `gain`), **normal**, **high** (≥ 2 × median, `warn`). Thresholds tunable.
- `goldCost` table: per-item values maintained in `packages/shared` (source to be chosen,
  §9).

### 5.6 Ranking

Margin and volume are **separate columns** (no combined score). Default sort: **margin %**
among flips passing the filters (min volume, min recurrence); volume and recurrence are
sortable too.

## 6. UI

Header: "Forbidden Rites · exchange data for 14:00–15:00 UTC (1 h 40 min old)".

Controls: flip type (`Segmented`: all / spread / cross-pair), min volume (units), min
margin, category (`Chips`), search. All in the URL.

Table:

| Item | Type | Buy (pay → get) | Sell (pay → get) | Convert | Margin % | Volume 24 h | Recurrence |

- Ratios shown in in-game form, with currency icons.
- Row click → `Sheet`: per-hour margin over the last 24 h (`Sparkline`), the ratio range
  of each leg, stock range, step-by-step order list to place in-game.

Stale data (> 3 h) → `Notice` warning, same as other tools.

## 7. Edge cases

- Hub market missing that hour → cross-pair flips through it are skipped for that hour.
- Extreme outliers (one fat-finger trade) → ratio range capped by the recurrence filter;
  hours with `p_high / p_low > 3` are flagged and excluded from recurrence.
- League launch / maintenance → empty hours; the window is shorter, recurrence computed on
  the hours available (shown).

## 8. Milestones

1. **M2a — probe**: add the GGG feed to the `poe.ninja probe` workflow (renamed "data
   probe"); capture fixtures; confirm field meanings (ratio orientation, range semantics,
   base ids), and write them up in `05-ggg-exchange-api.md`.
2. **M2b — data job**: fetch + rolling window + `flips.json`; item mapping.
3. **M2c — UI**: flips table + detail sheet; registry status `beta`.

## 9. Open points

- **Recurrence thresholds** (min margin, min share of hours): calibrate on real data.
- **Gold (deferred)** — fee model: per unit of the item received? of the item paid? per order? To be
  checked in-game (place two orders of different quantities, note the fees) or found in
  game data.
- **Gold cost table source** (wiki table, game data export).
- **Gold low/high**: relative to the median of listed flips (proposed) vs fixed values.
- **Base id mapping source**.
- Whether `lowest_ratio`/`highest_ratio` really bound executed trades or offered orders
  (probe).
