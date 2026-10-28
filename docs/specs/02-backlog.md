# Tool backlog (after M1)

Order is indicative. Each will get its own spec file before implementation.

1. **Currency flipping suggester** — done (beta): [`04-currency-flipping.md`](./04-currency-flipping.md)
   (data from GGG's hourly currency-exchange feed).
2. **Cheapest currency path** — for an item purchasable on the currency exchange, tell
   whether it is cheaper to pay in divine, chaos or exalted (and whether converting first
   is worth it), using live cross rates. Reuses the exchange-rate service.
   → Done (beta): [`04-cheapest-currency.md`](./04-cheapest-currency.md) (direct payment only).
3. **Crafting recipes tool** — catalogue of crafting recipes/methods with live cost per
   attempt and expected cost — done (beta): [`08-crafting-recipes.md`](./08-crafting-recipes.md)
   (in-app editor, typed-in odds first).
4. **Sell Now** — done: [`06-sell-now.md`](./06-sell-now.md) (sell at last league's peak
   or when falling with no recovery ahead).
5. **PoE 1** — done: every economy tool for PoE 1, ready for the 3.30 launch
   ([`07-poe1.md`](./07-poe1.md)). Cheapest currency path (2) built along with it.
6. **What to Farm** — done (beta): [`09-what-to-farm.md`](./09-what-to-farm.md) (rank league
   mechanics by the value, liquidity and outlook of their loot).

Shared needs anticipated in M1 design: exchange-rate service (1, 2, 3), price service
(all), history service (1).
