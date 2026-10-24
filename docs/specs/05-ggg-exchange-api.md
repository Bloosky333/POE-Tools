# GGG currency-exchange feed — verified facts (probe of 2026-10-24)

Captured by the `poe.ninja probe` workflow (`source: exchange`); fixtures in
`fixtures/ggg-exchange/probe/` (three complete hours, 02:00–05:00 UTC, Forbidden Rites
markets only, plus a poe.ninja Currency overview from the same run).

## Endpoint

`GET https://web.poecdn.com/api/currency-exchange/poe2/{hourEpoch}` — public, no auth, a
User-Agent is enough. `{hourEpoch}` = start of a UTC hour (unix seconds). The response for
the last complete hour was available ~1 h 10 min after its start.

```jsonc
{
  "next_change_id": 1792818000, // = hourEpoch + 3600
  "markets": [
    {
      "league": "Forbidden Rites",
      "market_id": "Metadata/Items/Currency/CurrencyRerollRare|Metadata/Items/Currency/CurrencyModValues",
      "market_pair": ["…/CurrencyRerollRare", "…/CurrencyModValues"],
      "volume_traded": { "…/CurrencyRerollRare": 557580, "…/CurrencyModValues": 57098 },
      "lowest_stock": { "…/CurrencyRerollRare": 578613, "…/CurrencyModValues": 38491 },
      "highest_stock": { "…/CurrencyRerollRare": 657892, "…/CurrencyModValues": 48718 },
      "lowest_ratio": { "…/CurrencyRerollRare": 9, "…/CurrencyModValues": 1 },
      "highest_ratio": { "…/CurrencyRerollRare": 10, "…/CurrencyModValues": 1 },
    },
  ],
}
```

- ~2,300 markets per hour over all leagues (raw ~1.9 MB); Forbidden Rites ≈ 1,460 markets,
  ≈ 1,150 with trades. Private leagues (`… (PL12345)`), Hardcore and Standard appear too and
  must be filtered by exact league name.
- Hubs by number of markets: chaos `CurrencyRerollRare` (~490), exalted
  `CurrencyAddModToRare` (~480), divine `CurrencyModValues` (~390). Everything else ≤ 25.

## Field semantics (verified)

- **Ratios** are integer quantities of each side of one trade, keyed by base id: `{chaos: 9,
divine: 1}` = 9 chaos ↔ 1 divine. "Lowest"/"highest" order the value
  `q(market_pair[0]) / q(market_pair[1])`. Ratios are reduced fractions (e.g. `5 : 378`).
- **`volume_traded`** = total quantity of each side exchanged in the hour, so
  `volume_traded[A] / volume_traded[B]` is the **volume-weighted average ratio (VWAP)**. It
  falls inside `[lowest, highest]` in 3,276 / 3,276 traded item ↔ hub market-hours checked.
- Hub cross-check against poe.ninja (same run): divine = 9.77 chaos VWAP (range 9–10; ninja
  9.83), 697 exalted VWAP (range 671–707; ninja 690.8).
- **Stock** = range of quantity listed on each side during the hour (depth), not trades.
  Markets can show stock with zero volume.

## What the data looks like (Forbidden Rites, item ↔ hub markets with trades)

- **Ranges are wide**: median `highest/lowest − 1` ≈ 17 % over all markets, ≈ 50–66 % on
  markets with ≥ 100 units traded; ~37 % of markets have a single ratio (zero range).
  Cheap items trade at coarse ratios (`4 : 1` vs `5 : 1` = 25 %).
- **Optimistic cross-pair margins are meaningless**: buying at the low end and selling at
  the high end of each leg gives > 3 % on ~70 % of all directions (median +60 %).
- **VWAP cross-pair margins** are centred on 0 % (markets agree on average), with a real
  tail: ~90–105 directions > 3 % per hour with ≥ 20 div traded on each leg.
- Some gaps persist across the three hours, e.g. Gemcutter's Prism: ≈ 0.036–0.038 div in
  the chaos and divine markets but ≈ 15.6 exalted (≈ 0.022 div) in the exalted market,
  ~1,000–2,300 prisms/hour. To be confirmed in-game before trusting such signals.
- Indivisible units distort cheap items in the divine market (someone pays 1 div for 155
  Greater Transmutation Orbs, 7× their value) — a min divine value per leg is needed.
- Units traded can be large while value is tiny (1,645 Greater Transmutation Orbs ≈ 0.5 div),
  so a units-only volume filter lets these through.
