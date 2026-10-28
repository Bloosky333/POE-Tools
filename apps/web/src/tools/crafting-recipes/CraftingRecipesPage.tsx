import { getLeague, recipeCost, type Game, type Recipe } from '@poe-tools/shared';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { fetchCraftingData, fetchCurrent, useAsync } from '../../lib/data.ts';
import { formatAge } from '../../lib/format.ts';
import { unitInfo } from '../../lib/unit.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';
import {
  Amount,
  Button,
  DataTable,
  Notice,
  PageHeader,
  Skeleton,
  type Column,
} from '../../ui/index.ts';
import { CatalogContext, buildCatalog, useCatalog } from './catalog.ts';
import { RecipeEditor } from './RecipeEditor.tsx';
import { RecipeView, baseLabel } from './RecipeView.tsx';
import { downloadJson } from '../../lib/backup.ts';
import {
  exportFile,
  loadRecipes,
  mergeImport,
  newId,
  newRecipe,
  parseImport,
  storeRecipes,
} from './storage.ts';

/** Crafting Recipes (spec 08): recipes made in the browser, priced with live exchange data. */
export default function CraftingRecipesPage() {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const data = useAsync(`crafting:${settings.game}:${settings.leagueId}`, async () => {
    if (!league) throw new Error('No league selected');
    const [current, crafting] = await Promise.all([
      fetchCurrent(settings.game, league.id),
      fetchCraftingData(settings.game),
    ]);
    return { current, crafting };
  });
  const catalog = useMemo(
    () =>
      data.status === 'ready'
        ? buildCatalog(
            settings.game,
            data.data.current.items,
            data.data.crafting.mods.mods,
            data.data.crafting.bases.bases,
            unitInfo(settings.game, data.data.current),
          )
        : null,
    [data, settings.game],
  );

  return (
    <section className="space-y-5">
      {data.status === 'loading' && <Skeleton rows={4} label="Loading prices and mods" />}
      {data.status === 'error' && (
        <>
          <PageHeader title="Crafting Recipes" />
          <Notice>
            Prices or the mod list couldn&apos;t be loaded ({data.error.message}). The data job may
            not have run yet.
          </Notice>
        </>
      )}
      {catalog && (
        <CatalogContext value={catalog}>
          {/* Keyed by game: each game has its own saved recipes. */}
          <Recipes key={catalog.game} game={catalog.game} />
        </CatalogContext>
      )}
    </section>
  );
}

function Recipes({ game }: { game: Game }) {
  const [search, setSearch] = useSearchParams();
  const [recipes, setRecipes] = useState(() => loadRecipes(game));
  const [message, setMessage] = useState<string | null>(null);
  const save = (next: Recipe[]) => {
    setRecipes(next);
    storeRecipes(game, next);
  };
  const go = (id: string | null, opts: { edit?: boolean; base?: number } = {}) => {
    const out = new URLSearchParams();
    if (id) out.set('recipe', id);
    if (opts.edit) out.set('edit', '1');
    if (opts.base) out.set('base', String(opts.base));
    setSearch(out);
  };

  const id = search.get('recipe');
  const isNew = id === 'new';
  const recipe = isNew ? null : recipes.find((r) => r.id === id);
  const editing = search.get('edit') === '1' || isNew;
  const baseIndex = Math.max(
    0,
    Math.min(Math.floor(Number(search.get('base'))) || 0, (recipe?.bases.length ?? 1) - 1),
  );
  // Draft of the next new recipe: replaced once saved, so each new recipe gets its own id.
  const [draftNew, setDraftNew] = useState(() => newRecipe(game));

  if (id && !isNew && !recipe) {
    return (
      <>
        <PageHeader title="Crafting Recipes" />
        <Notice>This recipe isn&apos;t saved in this browser.</Notice>
        <Button onClick={() => go(null)}>Back to recipes</Button>
      </>
    );
  }

  if (editing) {
    const current = recipe ?? draftNew;
    return (
      <>
        <PageHeader title={isNew ? 'New recipe' : `Edit: ${current.name}`} />
        <RecipeEditor
          key={current.id}
          recipe={current}
          onCancel={() => go(isNew ? null : current.id)}
          onSave={(saved) => {
            save(isNew ? [...recipes, saved] : recipes.map((r) => (r.id === saved.id ? saved : r)));
            if (isNew) setDraftNew(newRecipe(game));
            go(saved.id);
          }}
        />
      </>
    );
  }

  if (recipe) {
    return (
      <>
        <PageHeader
          title={recipe.name}
          description={`${recipe.steps.length} steps · updated ${formatAge(recipe.updatedAt)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => go(null)}>
                ← Recipes
              </Button>
              <Button variant="primary" onClick={() => go(recipe.id, { edit: true })}>
                Edit
              </Button>
              <Button
                onClick={() => {
                  const copy = {
                    ...recipe,
                    id: newId(),
                    name: `${recipe.name} (copy)`,
                    updatedAt: new Date().toISOString(),
                  };
                  save([...recipes, copy]);
                  go(copy.id, { edit: true });
                }}
              >
                Duplicate
              </Button>
              <Button
                onClick={() => downloadJson(`${slug(recipe.name)}.json`, exportFile([recipe]))}
              >
                Export
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
                  save(recipes.filter((r) => r.id !== recipe.id));
                  go(null);
                }}
              >
                Delete
              </Button>
            </div>
          }
        />
        <RecipeView
          recipe={recipe}
          baseIndex={baseIndex}
          onBaseChange={(base) => go(recipe.id, { base })}
        />
      </>
    );
  }

  return (
    <RecipeList
      recipes={recipes}
      message={message}
      onOpen={(r) => go(r.id)}
      onNew={() => go('new')}
      onImport={(text) => {
        try {
          const {
            recipes: merged,
            changed,
            otherGame,
          } = mergeImport(game, recipes, parseImport(text));
          save(merged);
          setMessage(
            `${changed} recipe${changed === 1 ? '' : 's'} imported.` +
              (otherGame
                ? ` ${otherGame} for the other game left out (switch game to import ${otherGame === 1 ? 'it' : 'them'}).`
                : ''),
          );
        } catch (error) {
          setMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}.`);
        }
      }}
    />
  );
}

function RecipeList({
  recipes,
  message,
  onOpen,
  onNew,
  onImport,
}: {
  recipes: Recipe[];
  message: string | null;
  onOpen: (recipe: Recipe) => void;
  onNew: () => void;
  onImport: (text: string) => void;
}) {
  const catalog = useCatalog();
  const now = useNow();
  const file = useRef<HTMLInputElement>(null);
  const rows = useMemo(
    () =>
      [...recipes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((recipe) => ({
          recipe,
          cost: recipeCost(recipe, 0, (id) => catalog.items.get(id)?.price),
        })),
    [recipes, catalog],
  );
  type Row = (typeof rows)[number];
  const columns: Column<Row, never>[] = [
    {
      id: 'name',
      label: 'Recipe',
      render: (r) => <span className="font-medium">{r.recipe.name}</span>,
    },
    {
      id: 'base',
      label: 'Base',
      render: (r) => {
        const first = r.recipe.bases[0];
        if (!first) return <span className="text-subtle">–</span>;
        const name = catalog.basesById.get(first.baseId)?.name ?? first.baseId;
        const more = r.recipe.bases.length - 1;
        return (
          <span>
            {baseLabel(name, first)}
            {more > 0 && <span className="text-subtle"> +{more}</span>}
          </span>
        );
      },
    },
    { id: 'steps', label: 'Steps', align: 'right', render: (r) => r.recipe.steps.length },
    {
      id: 'total',
      label: 'Expected total',
      align: 'right',
      title: 'With the first base',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {r.cost.unpriced.length > 0 && (
            <span className="text-warn" title="Some items have no price">
              ?
            </span>
          )}
          <Amount value={r.cost.total} unit={catalog.unit} />
        </span>
      ),
    },
    {
      id: 'updated',
      label: 'Updated',
      align: 'right',
      render: (r) => <span className="text-muted">{formatAge(r.recipe.updatedAt, now)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Crafting Recipes"
        description="Your crafting methods, step by step, with live currency cost and expected total. Saved in this browser."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onNew}>
              New recipe
            </Button>
            <Button onClick={() => file.current?.click()}>Import</Button>
            <Button
              disabled={!recipes.length}
              onClick={() => downloadJson('crafting-recipes.json', exportFile(recipes))}
            >
              Export all
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const chosen = e.target.files?.[0];
                e.target.value = '';
                if (chosen) onImport(await chosen.text());
              }}
            />
          </div>
        }
      />
      {message && <p className="text-sm text-muted">{message}</p>}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.recipe.id}
        onRowClick={(r) => onOpen(r.recipe)}
        minWidth="40rem"
        empty="No recipe yet. Create one, or import a file exported from another browser."
      />
    </>
  );
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'recipe'
  );
}
