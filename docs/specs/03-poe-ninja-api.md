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

Open points for the data job:

- Exact meaning/direction of `rate` per pair (divine-per-item vs item-per-divine) — to
  cross-check against `primaryValue` across several items before relying on it.
- `id` uses `detailsId` (e.g. `chaos-orb`); `id=divine` → 404.

## Consequences for the design

- **Reference-league backfill solved**: one throttled pass over the details endpoint per
  liquid item (~200 requests at ≥ 1.5 s ≈ 5 min), run once per league and stored in the
  `data` branch. Undocumented but part of the economy API; used sparingly and never in the
  hourly loop.
- **Current league history** is available the same way — no need to wait for our own
  snapshots; the daily job can refresh it incrementally (only items whose overview changed,
  or a rolling subset) to keep volume low.
- **Day alignment**: history points are at 00:00 UTC while leagues start at ~20:00 UTC.
  League day = UTC calendar day of the point − UTC calendar day of the league start
  (start day = day 0, partial).
- Prices are natively in divine (`core.primary = "divine"`), matching the "divine only"
  decision; divine itself is priced via `core.rates`.
