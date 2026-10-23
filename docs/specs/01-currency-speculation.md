# Tool #1 — Currency Speculation Advisor (DRAFT v0.3)

Game: **PoE 2** (M1). Unit: **divine only** (decided — the goal is big profits; lesser
units are noise).

## 1. Goal
A **decision-making** tool: tell the player what to **buy now**, what to **wait on**,
what to **avoid**, and — for what they already hold — when to **sell**, based on how
the same items behaved in the **previous league** at the **same point in time** since
league start.

## 2. Leagues & time alignment
- `d` = days elapsed since the current league started (UTC, fractional allowed).
- **Current league** (default): *Forbidden Rites* (0.5.5 event league, economy reset),
  started **2026-09-04 20:00 UTC** → day ~49 on 2026-10-23.
- **Reference league** (decided: **only the immediately previous league**, older
  leagues' economies are too different to be relevant): for Forbidden Rites this is
  *Runes of Aldur* (0.5.0), started **2026-05-29**. It is still running, which gives a
  long reference curve (~147 days at the time of writing).
- Previous PoE 2 leagues are kept in `leagues.json` (needed for backfill/history), but
  only one reference league is used in computations. The user can override the
  reference league in the UI (advanced setting) for odd cases.
- League dates live in `leagues.json`, maintained by Claude/manually per league
  (a new league = one PR). Auto-detect via poe.ninja's league list where possible.
- Softcore trade leagues only (Hardcore not in M1).

## 3. Data

### 3.1 Current league
- poe.ninja PoE 2 economy overview endpoints (documented, supported).
- **Categories (decided)**: currency + common stackables — Currency, Fragments,
  Essences, Omens, Runes, Soul Cores, Catalysts, Distilled Emotions, and the
  league-mechanic stackables poe.ninja lists (Breach, Delirium, Ritual, Expedition,
  Abyss…). Exact list confirmed by the M0 probe.
- Fields: item id, name, icon, price (converted to divine), volume / listing count,
  short-term sparkline if provided.

### 3.2 Reference league history (Runes of Aldur) — backfill
PoE 2 has had several leagues, so previous-league data exists; the question is only
*how to obtain daily series* without abusing poe.ninja. Order of preference, decided
by the M0 probe:
1. **poe.ninja data dumps** for the league, if published for PoE 2.
2. **One-time, throttled backfill** of the per-item history used by poe.ninja's charts
   (a few hundred requests, ≥ 1 s apart, run once per league, results stored forever in
   the `data` branch). Undocumented → used only for this one-shot backfill, never in
   the recurring job.
3. Another public PoE 2 economy source with history (e.g. poe2scout) as a fallback.
4. From now on, our own daily snapshots make us independent of 1–3 for future leagues.

Since Runes of Aldur is still live, we also snapshot it daily (cheap, extends the
reference curve, and helps the league after Forbidden Rites).

Stored per league/category: `{ itemId: [[day, priceDiv, volume], …] }`.

## 4. Suggestion engine (decided: suggestions are a must)

Notation: `R(t)` = reference-league price (div) on day `t`; `N(t)` = current-league
price; `d` = today.

### 4.1 Sell-point modes (decided: all, user-selectable)
| Mode | Sell day `s` | Multiplier `M = R(s) / R(d)` |
|---|---|---|
| Fixed horizon | `d + h`, h ∈ {7, 14, 30} | "hold h days" |
| Peak | `argmax R(t)`, `t > d` | best case, with the peak day |
| End of league | last day of reference data | "hold to the end" |

`projected sell = N(d) × M`, `profit/unit = projected − N(d)`.

### 4.2 Buy timing
`b = argmin R(t)` for `t ∈ [d, s)`. If `R(b) < R(d) × (1 − dipThreshold)` (default
10 %), the item will likely get cheaper first → suggestion **WAIT, buy around day b**
(with the expected discount). The multiplier is then also shown from `b`.

### 4.3 Actions
| Action | Rule (defaults, tunable) |
|---|---|
| **BUY NOW** | `M ≥ 1.3`, no significant dip ahead, liquidity OK |
| **WAIT** | significant dip expected before the rise (4.2) |
| **AVOID** | `M < 1.0` (expected to lose value) |
| **NEUTRAL** | everything else |
| **SELL** *(held positions)* | reference price has peaked (`d ≥ peak day`), or remaining upside `< 5 %`, or price reached the user's target |
| **HOLD** *(held positions)* | remaining upside still ≥ 5 % |

### 4.4 Confidence (0–100)
Combines:
- **Trajectory similarity**: correlation of `N` and `R` (normalised to day-0 price, in
  divine) over the last 7–14 days, plus ratio drift `N(d)/N(0)` vs `R(d)/R(0)`.
- **Liquidity** in both leagues (volume / listing count).
- **Data completeness** (missing days around `d` and `s`).
- **League phase**: low confidence on days 0–3 (launch chaos).

**Score** used for ranking = `(M − 1) × confidence / 100`.

### 4.5 Filters
- Min liquidity (default on), min unit price (default 0.05 div, configurable — cheap
  items can still matter in bulk), category, search.

## 5. UI

### 5.1 Suggestions table (main view)
Header: "Forbidden Rites — day 49 · compared with Runes of Aldur day 49 · prices 23 min old".

| Item | Cat. | Now (div) | Action | Multiplier | Buy day | Sell day | Projected (div) | Confidence | Liquidity | 7d trend |

Controls: mode, horizon, min liquidity, min price, category, search, action filter
(e.g. only BUY NOW).

### 5.2 Item detail
- Chart: reference vs current league prices (divine), x = days since league start,
  marker at today, shaded suggested buy/sell windows.
- Stats: peak day/price, low day/price after `d`, max drawdown, volumes, confidence
  breakdown (why the tool says what it says).

### 5.3 Positions tracker (decided: wanted in M1)
- Add position: item, quantity, buy price (div, defaults to current), buy date, optional
  target sell price.
- Table: current value, P/L (div and %), engine action **HOLD/SELL** with reason,
  expected sell day/price.
- Closing a position records sell price → realised P/L history.
- Stored in `localStorage`, JSON export/import.

### 5.4 Budget basket (decided: wanted, M1 if not too complex — it isn't)
- Input: budget in divine, max items, max share per item (default 30 %).
- Greedy allocation by score among BUY NOW items, each capped by liquidity (default:
  ≤ 10 % of the item's daily volume) so the basket is actually buyable.
- Output: list with quantity, cost, expected value at sell day, expected profit; one
  click to add all as positions.

### 5.5 Alerts (decided: wanted — M1 in-app only)
- User sets price targets (above/below) on any item or position.
- Checked whenever the app loads/refreshes data (hourly polling of our JSON while the
  tab is open); shown as an in-app banner and optional browser notification.
- Server-side alerts (Discord webhook from the data job) → later, requires alert
  definitions stored in the repo or a backend.

## 6. Edge cases
- Item missing in reference league (new mechanic) → "no reference", action NEUTRAL,
  only current trend shown.
- Reference league data shorter than `s` → clipped to last day, flagged.
- Missing days → nearest-day / linear interpolation, flagged in confidence.
- Day 0–3 → warning banner, low confidence.
- Event league with very different rules → user can override the reference league.

## 7. Acceptance criteria (M1)
- Data job publishes current prices hourly and daily snapshots; reference league
  backfilled.
- Suggestions table shows every in-scope item with action, multiplier, buy/sell days,
  confidence, for all three modes.
- Detail chart overlays both leagues aligned on days since start.
- Positions, budget basket and in-app alerts work and persist across reloads.
- Engine unit-tested: alignment, modes, dip detection, actions, confidence, edge cases.
