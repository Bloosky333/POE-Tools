# POE-Tools

A web app collecting tools for Path of Exile 1 & 2, built incrementally.

## Development

Requires Node 22 and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev     # web app on http://localhost:5173/POE-Tools/
pnpm check   # format, lint, typecheck, tests
pnpm build
```

Repository layout: `apps/web` (site), `packages/shared` (shared code and engines),
`packages/data-job` (hourly job reading poe.ninja and GGG's currency-exchange feed),
`docs/specs` (specifications), `docs/ui-guidelines.md` (UI kit and conventions).

## Specs

- [App overview & shell](docs/specs/00-overview.md)
- [Tool #1 — Currency Speculation Advisor](docs/specs/01-currency-speculation.md)
- [Tool backlog](docs/specs/02-backlog.md)
- [poe.ninja API — verified facts](docs/specs/03-poe-ninja-api.md)
- [Buy With / Sell For](docs/specs/04-buy-with-sell-for.md)
- [Currency Flipping](docs/specs/04-currency-flipping.md)
- [GGG currency-exchange feed — verified facts](docs/specs/05-ggg-exchange-api.md)
- [Sell Now](docs/specs/06-sell-now.md)
- [PoE 1](docs/specs/07-poe1.md)
- [Crafting Recipes](docs/specs/08-crafting-recipes.md)
- [What to Farm](docs/specs/09-what-to-farm.md)
- [Decisions & open questions](docs/specs/open-questions.md)
