# Tool #2 — Sell Now (v1.0 — agreed 2026-10-24)

Game: **PoE 2**. Unit: **divine**. Same leagues, categories and data as tool #1
(`01-currency-speculation.md` §2–3): no new poe.ninja calls.

## 1. Goal

List the exchange items to **sell now** because their value is at a high that last league
says will not last, or because they are falling with no recovery ahead.

- **Scope (decided):** the whole market (every liquid in-scope item). The player's own stash
  is out of v1 (→ open question: stash import).
- **No alerts in v1** (decided): page only.

## 2. Signals

Notation as in spec 01: `R(t)` reference-league price, `N(t)` current-league price, `d`
today, `N(d)` = current hourly price. Change over `k` days: `N(d) / N(d − k) − 1`, `k` ∈
{1, 3, 7}; "vs market" divides by the market's median change (liquid items: volume ≥ 5
div/day, price ≥ 0.05 div, ≥ 10 items).

An item is flagged when **either** signal fires; the row shows which (`Peak`, `Falling`).

| Signal      | Rule (defaults)                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Peak**    | Peak day `p` = highest `R` in `[d, d + 7]` (only if ≥ 3 % above `R(d)`, else `p = d`); fires when `R(p + 14) / R(p) ≤ 0.85` (last league fell ≥ 15 % in the 14 days after). |
| **Falling** | `N` fell ≥ 15 % over 7 days **and** last league did not recover: `R(d + 14) / R(d) ≤ 1`.                                                                                    |

## 3. Verdicts

| Verdict       | Rule                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **SELL NOW**  | Falling, or Peak with `p = d`.                                          |
| **SELL SOON** | Peak with `p > d` (last league still peaks within 7 days), sell on `p`. |
| **HOLD**      | Everything else (hidden by default).                                    |

- **Expected loss** if held = the larger of `1 − R(p + 14) / R(p)` (peak) and
  `1 − R(d + 14) / R(d)`.
- **Confidence**: as spec 01 §4.4 (similarity, liquidity, completeness, launch phase).
- **Ranking**: SELL NOW, then SELL SOON, then HOLD; within each, expected loss ×
  confidence.

## 4. UI

Table: Item, Verdict (+ signals or sell day), Price, 14-day sparkline, 1d / 3d / 7d change,
vs this league's high, last league's move (to day `p + 14`), expected loss, confidence,
volume. Filters (URL): verdict (default SELL NOW + SELL SOON), category, search, min volume
(5 div/day), min price (0.05 div). Detail sheet: reasons, both-league chart with the
peak → `p + 14` window shaded, changes, reference peak, confidence breakdown. Currency
Speculation's item detail links to Sell Now when the item is flagged there.

## 5. Backtest

`pnpm --filter @poe-tools/data-job backtest-sell --data-dir <data branch checkout>`

Forbidden Rites days 7–48 vs Runes of Aldur, items with ≥ 5 div/day volume. The market
rose ~15 % against divine over 14 days in that period, so calls are judged **vs the
market** (median later price change of liquid items):

| Calls     |    n | 14 d later, vs market | Worse than the market |
| --------- | ---: | --------------------: | --------------------: |
| SELL NOW  |  783 |                 ×0.90 |                  64 % |
| — Peak    |  730 |                 ×0.88 |                  65 % |
| — Falling |  324 |                 ×0.86 |                  63 % |
| SELL SOON |  977 |                 ×0.92 |                  62 % |
| HOLD      | 7518 |                 ×1.02 |                  47 % |

Findings that changed the first draft:

- **Short drops rebound**: 1- and 3-day drops (−8 % / −15 %) did not predict further
  drops (×1.00 vs market, 50 %); after a fall, ~29 % of the drop came back within 7 days.
  A 7-day drop works only when last league did not recover (×0.89); with a rising
  reference it rebounds (×1.05). 1d / 3d changes are shown, not used.
- **No "still rising" guard**: peak items still rising ≥ 10 % in 3 days (vs market) did
  slightly _worse_ afterwards (×0.87 vs ×0.91), so delaying the sale gained nothing.
- Peak drop 10 % / 25 % and fall drop 10 % / 25 % gave about the same results; a 7-day
  horizon was weaker (×0.93); measuring the 7-day fall vs the market was slightly weaker.
- In absolute divine, flagged items still rose ~3 % over 14 days in that period: in a
  market rising against divine, "sell" mostly means "will lag", not "will drop". Re-run
  the backtest each league.
