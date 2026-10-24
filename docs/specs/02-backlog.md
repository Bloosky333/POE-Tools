# Tool backlog (after M1)

Order is indicative. Each will get its own spec file before implementation.

1. **Currency flipping suggester** — spec drafted: [`04-currency-flipping.md`](./04-currency-flipping.md)
   (data from GGG's hourly currency-exchange feed).
2. **Cheapest currency path** — for an item purchasable on the currency exchange, tell
   whether it is cheaper to pay in divine, chaos or exalted (and whether converting first
   is worth it), using live cross rates. Reuses the exchange-rate service.
   → Specified in [`04-cheapest-currency.md`](./04-cheapest-currency.md) (direct payment only).
3. **Crafting recipes tool** — catalogue of crafting recipes/methods with live cost per
   attempt and expected cost (scope to be defined: which recipes, data source for
   mod weights).

Shared needs anticipated in M1 design: exchange-rate service (1, 2, 3), price service
(all), history service (1). 4. **Sell Now** — what to sell today (reference peak or falling price); in development
(spec `04-sell-now.md`, branch `ccr-9d59f9e2-b0syw5`). 5. **PoE 1 port** of tools 1–4 for the 3.30 launch — spec drafted:
[`06-poe1.md`](./06-poe1.md).
