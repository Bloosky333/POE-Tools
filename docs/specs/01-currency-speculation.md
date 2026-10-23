# Tool #1 — Currency Speculation Advisor (DRAFT v0.1)

## 1. Goal
Help the player decide **which currencies to buy now and sell later for profit**, based
on how the same currencies behaved in the **previous league(s)** at the **same point in
time** since league start.

## 2. Core idea

Let:
- `d` = days elapsed since the current league started (e.g. day 12).
- `P_prev(c, t)` = price of currency `c` in the previous league on day `t`.
- `P_now(c)` = current price of `c` in the current league.

For each currency, look at the previous league:

```
multiplier(c, d, h) = P_prev(c, d + h) / P_prev(c, d)
```

i.e. "in the last league, if you had bought on the same day `d` and sold `h` days later,
how much would your money have multiplied?" **[OPEN Q7: definition of the sell point]**

Proposed variants (user selectable):
| Mode | Sell point | Meaning |
|---|---|---|
| Fixed horizon | `d + h` (h = 7, 14, 30 days) | "Hold for h days" |
| Peak | `max(P_prev(c, t))` for `t > d` and the day it happened | Best-case, with the day it peaked |
| End of league | last available day | "Hold until the end" |

The current price `P_now(c)` is then used to:
- show the **projected sell price** = `P_now(c) × multiplier`;
- show the **expected profit per unit** and per **N divines invested**;
- flag a **divergence warning** when the current league is already far from the previous
  league's trajectory (e.g. `P_now / P_now_at_day_0` vs `P_prev(d) / P_prev(0)`), since
  the pattern may not repeat.

## 3. Data

### 3.1 Current league
- poe.ninja economy overview endpoints (supported public API), for the categories in
  scope **[OPEN Q8]**.
- Fields used: id/name, icon, price in base unit, listing count / volume (liquidity),
  sparkline (last 7 days trend) if available.
- Refreshed ~hourly by the backend, also stored as **daily snapshots** so we build our
  own history going forward (and stop depending on external history later).

### 3.2 Previous league(s) — **[OPEN Q6]**
Options for getting daily prices of a finished league:
1. **poe.ninja data dumps** (per-league files of daily prices published after leagues
   end) — preferred: one-time download, legal, no API hammering. Need to confirm format
   and PoE2 availability.
2. poe.ninja history endpoints used by the website — undocumented / unsupported per
   their docs, so **not** preferred.
3. Self-collected snapshots — only works from the league after we start collecting.

Ingested once per league into SQLite: `(game, league, item_id, day, price_chaos,
price_divine, volume)`.

### 3.3 League metadata
League name and **start date** per game. Source **[OPEN Q9]**: manual config file
(simple, reliable) vs. automatic detection.

## 4. Price unit & inflation
Raw chaos prices are distorted by chaos/divine ratio changes during a league.
**[ASSUMPTION — OPEN Q10]**: compute multipliers in **divine** (PoE1) or **exalted**
(PoE2) terms, with a toggle. Divine Orb itself is then excluded (or shown vs chaos).

## 5. Filtering & ranking
- **Liquidity filter**: hide items with too few listings / low volume (default threshold
  configurable) — a 10× on an untradeable item is useless.
- **Minimum price filter**: ignore items worth < X chaos (noise).
- **Ranking score** (default): `multiplier`, optionally penalised by low liquidity and
  high divergence. **[OPEN Q11]**
- Search box, category filter, sort by any column.

## 6. UI

### 6.1 Main table
| Icon | Currency | Now | Prev @ day d | Prev @ sell point | Multiplier | Sell day | Projected price | Liquidity | Trend 7d | Confidence |

- Header shows: "Current league: *X*, day 12. Compared with: *Y* (day 12)".
- Controls: game, league(s) to compare, mode (fixed horizon / peak / end), horizon `h`,
  unit, min liquidity, min price, category.
- Colour coding: green multiplier > 1.5, neutral 0.9–1.5, red < 0.9 (thresholds TBD).

### 6.2 Detail view (click a row)
- Chart overlaying the previous league curve and the current league curve, aligned on
  **days since league start**, with a vertical marker at "today" (day d).
- Key stats: best buy day / best sell day in the previous league, max drawdown, volume.

### 6.3 Optional (later)
- Multi-league comparison (average / median multiplier over the last N leagues).
- Personal "positions" tracker (I bought 200 X at Y) with live P/L. **[OPEN Q12]**

## 7. Edge cases
- Currency did not exist in the previous league (new mechanic) → shown as "no history".
- League lasted fewer days than `d + h` → sell point clipped to last day, flagged.
- Data gaps on some days → interpolate or use nearest day, flagged.
- Day 0–2 (league launch chaos): very volatile, warning banner.
- Previous league with a very different mechanic (e.g. currency added to drop pool)
  → user can choose a different reference league.

## 8. Acceptance criteria (M1c)
- Given day `d` of the current league, the table lists all in-scope currencies with
  their previous-league multiplier for the chosen mode, computed from stored history.
- Results are sortable/filterable; liquidity filter on by default.
- Detail chart overlays both leagues aligned on days since start.
- Data freshness is visible; stale data is flagged.
- Unit tests cover the multiplier computation, day alignment and edge cases above.
