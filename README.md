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

Repository layout: `apps/web` (site), `packages/shared` (shared code), `packages/data-job`
(scheduled poe.ninja job), `docs/specs` (specifications).

## Specs

- [App overview & shell](docs/specs/00-overview.md)
- [Tool #1 — Currency Speculation Advisor](docs/specs/01-currency-speculation.md)
- [Tool backlog](docs/specs/02-backlog.md)
- [poe.ninja API — verified facts](docs/specs/03-poe-ninja-api.md)
- [Decisions & open questions](docs/specs/open-questions.md)
