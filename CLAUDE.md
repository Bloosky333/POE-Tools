# POE-Tools — notes for Claude

Specs live in `docs/specs/` (agreed v1.0) — read them before changing behaviour; record new
decisions in `docs/specs/open-questions.md`.

## Layout

- `apps/web` — React + Vite SPA (Tailwind v4, react-router hash routing, deployed to
  GitHub Pages under `/POE-Tools/`). Tools live in `src/tools/<id>/` and are registered in
  `src/tools/registry.ts`.
- `packages/shared` — code shared by web and data job (league config, time utils, zod
  schemas, later the suggestion engine). Consumed as TypeScript source, no build step.
- `packages/data-job` — scheduled job talking to poe.ninja (only place allowed to).
- `fixtures/poe-ninja/`, `fixtures/ggg-exchange/` — real responses captured by the probe workflow.

## Commands

- `pnpm check` — format check, lint, typecheck, tests (run before every push).
- `pnpm build`, `pnpm dev`.
- `pnpm probe` / `pnpm probe:exchange` / `pnpm probe:base-items` — need network access; run via the
  "poe.ninja probe" workflow (input `source`).
- `pnpm job --data-dir <abs> --out <abs>` — data job (run hourly by the "Data" workflow;
  store on the orphan `data` branch, site data in `apps/web/public/data`, both gitignored).
- `pnpm --filter @poe-tools/data-job dev-data --data-dir <data branch checkout> --out
<abs>/apps/web/public/data` — local site data without network (history from the `data`
  branch, current prices from the probe fixtures).

## Rules

- UI: build pages from the kit in `apps/web/src/ui/` and the semantic color tokens; read
  `docs/ui-guidelines.md` before adding a tool. Raw Tailwind palette colors fail a test.
- External data (poe.ninja, GGG currency-exchange feed): call only from the data job,
  throttled, with the `USER_AGENT` from `packages/data-job/src/poe-ninja/client.ts`. Never
  from the browser.
- Prices are expressed in divine.
- Pin exact dependency versions.
