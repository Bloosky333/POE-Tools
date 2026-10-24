import { describeCondition, recipeCost, type Recipe, type RecipeCost } from '@poe-tools/shared';
import {
  Amount,
  Badge,
  Card,
  DataTable,
  InlineField,
  Notice,
  Panel,
  Select,
  StatTile,
  type Column,
} from '../../ui/index.ts';
import { formatAmount } from '../../lib/format.ts';
import { useCatalog } from './catalog.ts';
import { ActionView, ItemName, StepKindBadge, gotoLabel, stepTitle } from './parts.tsx';

/** Recipe page: base selector, key figures, step costs and the shopping list (spec 08 §3). */
export function RecipeView({
  recipe,
  baseIndex,
  onBaseChange,
}: {
  recipe: Recipe;
  baseIndex: number;
  onBaseChange: (index: number) => void;
}) {
  const catalog = useCatalog();
  const { unit } = catalog;
  const cost = recipeCost(recipe, baseIndex, (id) => catalog.items.get(id)?.price);
  const currency = cost.total - (cost.base?.expected ?? 0);
  const condition = (c: Parameters<typeof describeCondition>[0]) =>
    describeCondition(c, catalog.familyLabel);

  return (
    <div className="space-y-5">
      {recipe.bases.length > 0 && (
        <InlineField label="Base">
          <Select value={baseIndex} onChange={(e) => onBaseChange(Number(e.target.value))}>
            {recipe.bases.map((b, i) => (
              <option key={`${b.baseId}-${i}`} value={i}>
                {baseLabel(catalog.basesById.get(b.baseId)?.name ?? b.baseId, b)}
              </option>
            ))}
          </Select>
        </InlineField>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Expected total"
          tone="accent"
          value={<Amount value={cost.total} unit={unit} />}
          detail={cost.unpriced.length ? 'Incomplete: unpriced items left out' : 'Average cost'}
        />
        <StatTile
          label="Base"
          value={<Amount value={cost.base?.expected ?? 0} unit={unit} />}
          detail={
            cost.base
              ? cost.base.runs > 1.0001
                ? `${cost.base.runs.toFixed(2)} bases × ${formatAmount(cost.base.price, unit.id)} ${unit.short}`
                : 'One base'
              : 'No base set'
          }
        />
        <StatTile label="Currency" value={<Amount value={currency} unit={unit} />} />
        <StatTile
          label="Unpriced items"
          tone={cost.unpriced.length ? 'warn' : 'default'}
          value={cost.unpriced.length}
          detail={cost.unpriced.length ? 'Set a manual price in Edit' : 'All priced'}
        />
      </div>

      {(recipe.notes || recipe.baseMods || recipe.target) && (
        <Card className="space-y-1.5 text-sm">
          {recipe.notes && <p className="whitespace-pre-line">{recipe.notes}</p>}
          {recipe.baseMods && (
            <p>
              <span className="text-muted">Base mods: </span>
              {condition(recipe.baseMods)}
            </p>
          )}
          {recipe.target && (
            <p>
              <span className="text-muted">Target: </span>
              {condition(recipe.target)}
            </p>
          )}
        </Card>
      )}

      {recipe.steps.length === 0 ? (
        <Notice>No steps yet: add them in Edit.</Notice>
      ) : (
        <StepsTable recipe={recipe} cost={cost} />
      )}

      {cost.items.length > 0 && <ShoppingList cost={cost} recipe={recipe} />}
    </div>
  );
}

export function baseLabel(name: string, base: Recipe['bases'][number]): string {
  const extra = [base.rarity, base.minItemLevel ? `ilvl ${base.minItemLevel}+` : '']
    .filter(Boolean)
    .join(', ');
  return extra ? `${name} (${extra})` : name;
}

function StepsTable({ recipe, cost }: { recipe: Recipe; cost: RecipeCost }) {
  const catalog = useCatalog();
  const { unit } = catalog;
  const condition = (c: Parameters<typeof describeCondition>[0]) =>
    describeCondition(c, catalog.familyLabel);
  type Row = RecipeCost['steps'][number];
  const columns: Column<Row, never>[] = [
    {
      id: 'n',
      label: '#',
      className: 'w-8 text-subtle',
      render: (row) => row.stepIndex + 1,
    },
    {
      id: 'step',
      label: 'Step',
      render: (row) => {
        const step = recipe.steps[row.stepIndex];
        if (!step) return null;
        return (
          <div className="space-y-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <StepKindBadge kind={step.kind} />
              <span className="font-medium">{stepTitle(step, row.stepIndex)}</span>
            </div>
            {step.kind === 'loop' ? (
              <div className="space-y-0.5">
                {step.uses.map((u, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <ActionView action={u.action} />
                    <span className="text-xs text-subtle">≈ {u.expectedUses} uses</span>
                  </div>
                ))}
                {step.until && (
                  <div className="text-xs text-muted">Until {condition(step.until)}</div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <ActionView action={step.action} />
                {step.kind === 'apply' && step.times !== 1 && (
                  <span className="text-xs text-subtle">× {step.times}</span>
                )}
                {step.kind === 'best-effort' && (
                  <span className="text-xs text-subtle">≈ {step.expectedUses} uses</span>
                )}
              </div>
            )}
            {step.kind === 'gate' && (
              <div className="text-xs text-muted">
                {percent(step.successChance * 100)} success
                {step.success && <> ({condition(step.success)})</>}. On failure:{' '}
                {step.onFail.recovery && (
                  <>
                    <ActionView action={step.onFail.recovery} />, then{' '}
                  </>
                )}
                back to {gotoLabel(recipe, step.onFail.goto)}.
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'pass',
      label: 'One pass',
      align: 'right',
      title: 'Cost of doing the step once (without retries)',
      render: (row) => <Amount value={row.passCost} unit={unit} />,
    },
    {
      id: 'runs',
      label: 'Expected passes',
      align: 'right',
      title: 'How many times the step is done on average, retries of failed gates included',
      render: (row) => (
        <span className="tabular-nums">
          {row.runs.toFixed(row.runs % 1 ? 2 : 0)}
          {row.recoveryRuns !== undefined && row.recoveryRuns > 0 && (
            <span className="block text-xs text-subtle">
              + {row.recoveryRuns.toFixed(2)} recoveries
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'expected',
      label: 'Expected cost',
      align: 'right',
      render: (row) =>
        row.expected === null ? (
          <Badge tone="warn" icon="?">
            Unpriced
          </Badge>
        ) : (
          <Amount value={row.expected} unit={unit} />
        ),
    },
    {
      id: 'share',
      label: 'Share',
      align: 'right',
      render: (row) =>
        row.expected === null || cost.total <= 0 ? (
          '–'
        ) : (
          <span className="tabular-nums text-muted">
            {percent((row.expected / cost.total) * 100)}
          </span>
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={cost.steps}
      rowKey={(row) => recipe.steps[row.stepIndex]?.id ?? String(row.stepIndex)}
      minWidth="46rem"
    />
  );
}

function ShoppingList({ cost, recipe }: { cost: RecipeCost; recipe: Recipe }) {
  const { unit } = useCatalog();
  type Row = RecipeCost['items'][number];
  const rows = [...cost.items].sort((a, b) => (b.cost ?? Infinity) - (a.cost ?? Infinity));
  const columns: Column<Row, never>[] = [
    { id: 'item', label: 'Item', render: (row) => <ItemName itemId={row.itemId} /> },
    {
      id: 'uses',
      label: 'Expected uses',
      align: 'right',
      render: (row) => <span className="tabular-nums">{formatUses(row.uses)}</span>,
    },
    {
      id: 'price',
      label: 'Price',
      align: 'right',
      render: (row) =>
        row.price === null ? (
          <Badge tone="warn" icon="?">
            No price
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {row.manual && <Badge tone="neutral">Manual</Badge>}
            <Amount value={row.price} unit={unit} />
          </span>
        ),
    },
    {
      id: 'cost',
      label: 'Expected cost',
      align: 'right',
      render: (row) => <Amount value={row.cost} unit={unit} />,
    },
  ];
  return (
    <Panel
      title="Shopping list"
      subtitle={`Expected currency for one finished item${recipe.bases.length ? ' (bases not included)' : ''}`}
    >
      <div className="p-3">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.itemId} minWidth="32rem" />
      </div>
    </Panel>
  );
}

function formatUses(uses: number): string {
  return uses >= 10 || Number.isInteger(uses)
    ? Math.ceil(uses - 1e-9).toLocaleString('en-US')
    : uses.toFixed(2);
}

function percent(value: number): string {
  return `${value < 10 && value > 0 ? value.toFixed(1) : value.toFixed(0)}%`;
}
