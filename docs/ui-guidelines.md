# UI guidelines

Every tool shares one look and feel: dense, data-first, poe.ninja-inspired, dark by default.

## Building blocks — `apps/web/src/ui/`

Build pages from the kit; add to it (not to a tool folder) when something is reusable.

| Need                                          | Component                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Page title, description, actions on the right | `PageHeader`                                                         |
| Key figures row                               | `StatTile` (tone: `gain`/`warn`/`loss`/`accent`) in a `grid gap-3`   |
| Panel / section with header                   | `Panel`, plain bordered box `Card`                                   |
| Category / type filter                        | `TypeChips` (exchange categories), `Chips` (with counts)             |
| A few exclusive options (mode, period)        | `Segmented`                                                          |
| Filters                                       | `FilterBar` + `SearchInput`, `NumberField`, `InlineField` + `Select` |
| Tabular data                                  | `DataTable` (columns with `render`, sorting by caller, row click)    |
| Item with icon                                | `ItemCell` (`sm` / `md` / `lg`)                                      |
| Price / volume                                | `Amount` (value + unit icon; PoE 1: chaos with divine alongside)     |
| Status                                        | `Badge` / `StyledBadge` + `labelsOf` for verdict enums, `Pill`       |
| Change in %                                   | `Change` (fraction, or `ratio` vs 1)                                 |
| 0–100 score / ratio                           | `ScoreMeter`, `RatioBar`                                             |
| Small trend                                   | `Sparkline`                                                          |
| Item / row details                            | `Sheet` (side panel, Escape to close) with `StatCard`s               |
| Loading / errors                              | `LoadStatus` for a tool's data, `Skeleton`, `Notice`                 |

## Colors

Only semantic tokens (defined in `src/index.css`, light + dark):
`bg`, `surface`, `surface-2`, `line`, `fg`, `muted`, `subtle`, `accent`, `accent-soft`,
`on-accent`, `gain(-soft)`, `warn(-soft)`, `loss(-soft)` — e.g. `bg-surface text-muted
border-line`. Raw palette classes (`text-gray-500`, `bg-green-50`…) fail the
`UI conventions` test. Gain/loss/warn colors carry meaning only and are always paired with a
sign, icon or word. Charts use the `--series-*` variables (`.viz-root`).

## Layout & typography

- Page = `<section className="space-y-5">` starting with `PageHeader`.
- Numbers are right-aligned in tables; prices via `Amount` with the game's unit
  (`useLeagueData().unit` / `unitInfo`): divine in PoE 2, chaos in PoE 1. Thresholds that
  carry a unit come from `ECONOMY[game]`.
- Text sizes: page title `text-2xl font-semibold`, body `text-sm`, labels `text-xs text-muted`.
- Everything must work at 390 px wide without horizontal page scroll (tables scroll inside
  their own container).
- Filters and selections that matter live in the URL (bookmarkable): declare them with
  `useUrlParams` (`src/lib/urlParams.ts`); sort rows with `sortRows` (`src/lib/sort.ts`).

## Adding a tool

1. `apps/web/src/tools/<id>/<Name>Page.tsx` (default export), built with the kit.
2. One entry in `apps/web/src/tools/registry.ts` (name, description, icon from
   `components/icons.tsx`, category, status, path, lazy component).
3. Shared data access in `src/lib/data.ts`; pure logic in `packages/shared` with tests.
