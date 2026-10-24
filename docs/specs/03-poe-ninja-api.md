# poe.ninja API — verified facts (probe of 2026-10-23)

Captured by the `poe.ninja probe` workflow; raw responses in `fixtures/poe-ninja/probe/`.

## Policy (from https://poe.ninja/docs/api)

- Economy endpoints are the supported public surface (PoE 1 & 2); builds/profiles and other
  non-economy endpoints are forbidden for third parties.
- No versioning / SLA; routes usually kept stable with redirects (best effort).
- Apps must proxy through their own backend (our scheduled job), cache, send a descriptive
  User-Agent with contact, use conditional requests (ETag, ~5 min HTTP cache).
- PoE 2 data refreshes roughly **hourly**. Excessive use → blocked.
- Data dumps exist for **PoE 1 only** (`/poe1/data`); none for PoE 2.

## Endpoints used

### Leagues — documented

`GET /poe2/api/economy/leagues` → `[{ id, name }]`, first entry = current challenge league.
Today: `Forbidden Rites`, `Runes of Aldur`, `HC Forbidden Rites`, `HC Runes of Aldur`,
`Standard`, `Hardcore`. The `id` is the `league` query parameter.

### Exchange overview — documented

`GET /poe2/api/economy/exchange/current/overview?league={id}&type={type}`

PoE 2 `type` values: `Currency, Fragments, Abyss, UncutGems, LineageSupportGems, Essences,
SoulCores, Idols, Runes, Ritual (Omens), Expedition, Delirium (Liquid Emotions),
Breach (Catalysts), Verisium`.

```jsonc
{
  "core": {
    "primary": "divine",          // line values are quoted in divine for PoE 2
    "secondary": "chaos",
    "rates": { "exalted": 687.2, "chaos": 10.01 },  // units per 1 divine
    "items": [ /* divine, exalted, chaos metadata */ ]
  },
  "lines": [{
    "id": "alch",
    "primaryValue": 0.004664,        // price in divine
    "volumePrimaryValue": 77.0,      // daily traded volume, in divine
    "maxVolumeCurrency": "divine",
    "maxVolumeRate": 214.4,          // units of the pair currency per item (or inverse)
    "sparkline": { "totalChange": 3.53, "data": [/* 7 daily % changes */] }
  }],
  "items": [{ "id", "name", "image", "category", "detailsId" }]
}
```

Forbidden Rites, 2026-10-23: 632 items over 14 categories, ~200 with ≥ 10 div daily volume.

### Exchange details (per item, full league history) — undocumented, economy family

`GET /poe2/api/economy/exchange/current/details?league={id}&type={type}&id={detailsId}`

```jsonc
{
  "item": { "id": "chaos", "detailsId": "chaos-orb", ... },
  "pairs": [{
    "id": "divine",                 // pair currency
    "rate": 0.111,
    "volumePrimaryValue": 640.7,
    "history": [                    // one point per UTC day, newest first, whole league
      { "timestamp": "2026-10-23T00:00:00Z", "rate": 0.111, "volumePrimaryValue": 640.6 },
      ...
      { "timestamp": "2026-05-29T00:00:00Z", "rate": 0.03801, "volumePrimaryValue": 19.99 }
    ]
  }, { "id": "exalted", ... }],
  "core": { ... }
}
```

Runes of Aldur: 148 daily points (2026-05-29 → 2026-10-23), i.e. the **complete daily
history** of a league in one request per item.

Notes:

- **Rate directions (verified, pinned by `packages/data-job/src/pairs.test.ts`)**: the
  details `rate` is **units of the pair currency per item** (Chaos Orb/divine 0.111 ×
  9.01 chaos per divine ≈ 1; Divine Orb/exalted = `core.rates.exalted`). The overview
  `maxVolumeRate` is the **inverse**, items per unit of `maxVolumeCurrency`
  (`1 / maxVolumeRate = primaryValue` for every divine-paired line).
- **Pairs disagree a lot and persistently.** Forbidden Rites, 2026-10-15 → 10-24, in
  divine at core cross rates: Sione's Temper ≈ 1 via divine, ≈ 0.8 via chaos, ≈ 0.15 via
  exalted; Uncut Skill Gem 19 ≈ 0.14 / 0.13 / 0.025; Artificer's Orb ≈ 0.011 / 0.004 /
  0.0012. The exalted pair is 5–12× cheaper for 10+ days, which an open market would
  arbitrage away — real (tool #2's premise) or an artefact of how poe.ninja derives pair
  rates; to be checked in game. The overview's busiest-pair rate can also differ from the
  same pair's details rate (Sione's Temper/exalted: 205 vs 97 ex per item).
- `id` uses `detailsId` (e.g. `chaos-orb`); `id=divine` → 404.

## PoE 1 (probe of 2026-10-24, `fixtures/poe1/`)

Same routes under `/poe1/`, same response shapes; `core.primary = "chaos"`,
`core.rates = { divine: 0.003046 }`, details pairs `chaos` and `divine`. League ids
`Allflame`, `Hardcore Allflame`, `Standard`, `Hardcore`; the ended league `Mirage` still
answers overview and details. Details see [`07-poe1.md`](./07-poe1.md) §4.

## Consequences for the design

- **Reference-league backfill solved**: one throttled pass over the details endpoint per
  liquid item (~200 requests at ≥ 1.5 s ≈ 5 min), run once per league and stored in the
  `data` branch. Undocumented but part of the economy API; used sparingly and never in the
  hourly loop.
- **Current league history** is available the same way and is re-fetched daily for
  liquid items (~270 requests/day, ≈ 11/hour on average), so every item's series has a
  single source.
- **Day alignment**: history points are at 00:00 UTC while leagues start at ~20:00 UTC.
  League day = UTC calendar day of the point − UTC calendar day of the league start
  (start day = day 0, partial).
- Prices are natively in divine (`core.primary = "divine"`), matching the "divine only"
  decision; divine itself is priced via `core.rates`.
