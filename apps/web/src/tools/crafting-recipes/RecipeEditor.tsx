import {
  BASE_STEP,
  RARITIES,
  modFamilies,
  recipeItemIds,
  recipeSchema,
  type ModCondition,
  type Recipe,
  type Step,
  type StepKind,
} from '@poe-tools/shared';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Amount,
  Button,
  Card,
  Field,
  Input,
  Notice,
  Panel,
  SearchInput,
  Select,
  TextArea,
} from '../../ui/index.ts';
import { ActionEditor } from './ActionEditor.tsx';
import { recipeBases, searchBases, useCatalog } from './catalog.ts';
import { ConditionEditor } from './ConditionEditor.tsx';
import { ItemName, STEP_KINDS, StepKindBadge, stepTitle } from './parts.tsx';
import { newStep } from './storage.ts';

/** Edits a copy of the recipe; Save validates it (recipe schema) before handing it back. */
export function RecipeEditor({
  recipe,
  onSave,
  onCancel,
}: {
  recipe: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}) {
  const catalog = useCatalog();
  const [draft, setDraft] = useState<Recipe>(recipe);
  const [errors, setErrors] = useState<string[]>([]);
  const patch = (p: Partial<Recipe>) => setDraft((d) => ({ ...d, ...p }));
  const families = useMemo(
    () => modFamilies(catalog.mods, recipeBases(catalog, draft)),
    [catalog, draft],
  );

  const save = () => {
    const parsed = recipeSchema.safeParse(cleanRecipe(draft));
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => describeIssue(draft, i.path, i.message)));
      return;
    }
    setErrors([]);
    onSave({ ...parsed.data, updatedAt: new Date().toISOString() });
  };

  const setStep = (index: number, step: Step) =>
    patch({ steps: draft.steps.map((s, i) => (i === index ? step : s)) });
  const moveStep = (index: number, delta: number) => {
    const steps = [...draft.steps];
    const [step] = steps.splice(index, 1);
    if (step) steps.splice(index + delta, 0, step);
    patch({ steps });
  };

  return (
    <div className="space-y-5">
      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="Notes" className="md:row-span-2">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) =>
              patch(e.target.value ? { notes: e.target.value } : { notes: undefined })
            }
          />
        </Field>
      </Card>

      <BasesEditor draft={draft} onChange={(bases) => patch({ bases })} />

      <Panel
        title="Mods"
        subtitle="What to look for on the base, and the finished item (both optional)"
      >
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <OptionalCondition
            label="Base mods"
            value={draft.baseMods}
            families={families}
            onChange={(baseMods) => patch({ baseMods })}
          />
          <OptionalCondition
            label="Target"
            value={draft.target}
            families={families}
            onChange={(target) => patch({ target })}
          />
        </div>
      </Panel>

      <Panel title="Steps" subtitle="In crafting order">
        <ol className="space-y-3 p-4">
          {draft.steps.map((step, i) => (
            <li key={step.id}>
              <StepEditor
                index={i}
                step={step}
                recipe={draft}
                families={families}
                onChange={(s) => setStep(i, s)}
                onMove={(delta) => moveStep(i, delta)}
                onRemove={() => patch({ steps: draft.steps.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
          <li className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Add a step:</span>
            {STEP_KINDS.map((k) => (
              <Button
                key={k.value}
                title={k.hint}
                onClick={() => patch({ steps: [...draft.steps, newStep(k.value)] })}
              >
                + {k.label}
              </Button>
            ))}
          </li>
        </ol>
      </Panel>

      <PriceOverrides draft={draft} onChange={(priceOverrides) => patch({ priceOverrides })} />

      {errors.length > 0 && <Notice>Can&apos;t save yet: {errors.join('; ')}.</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Save recipe
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BasesEditor({
  draft,
  onChange,
}: {
  draft: Recipe;
  onChange: (bases: Recipe['bases']) => void;
}) {
  const { bases, basesById } = useCatalog();
  const [q, setQ] = useState('');
  const matches = searchBases(bases, q);
  const update = (i: number, p: Partial<Recipe['bases'][number]>) =>
    onChange(draft.bases.map((b, j) => (j === i ? { ...b, ...p } : b)));

  return (
    <Panel
      title="Bases"
      subtitle="One or several possible bases, each with its price (you pick one on the recipe page)"
    >
      <div className="space-y-3 p-4">
        {draft.bases.map((b, i) => {
          const base = basesById.get(b.baseId);
          return (
            <div key={`${b.baseId}-${i}`} className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <div className="font-medium">{base?.name ?? b.baseId}</div>
                <div className="text-xs text-subtle">
                  {base ? `${base.itemClass}, level ${base.level}` : 'Not in the base list'}
                </div>
              </div>
              <Field label="Min item level">
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={b.minItemLevel ?? ''}
                  onChange={(e) => {
                    const v = Math.floor(Number(e.target.value));
                    update(i, { minItemLevel: v > 0 ? v : undefined });
                  }}
                />
              </Field>
              <Field label="Rarity">
                <Select
                  value={b.rarity ?? ''}
                  onChange={(e) =>
                    update(i, {
                      rarity: (e.target.value || undefined) as
                        (typeof RARITIES)[number] | undefined,
                    })
                  }
                >
                  <option value="">Any</option>
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Price (div)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  className="w-24"
                  value={b.price}
                  onChange={(e) => update(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
              <Button
                variant="danger"
                onClick={() => onChange(draft.bases.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          );
        })}
        <div className="relative">
          <SearchInput placeholder="Add a base (name or class)" value={q} onChange={setQ} />
          {matches.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-72 w-[min(28rem,90vw)] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
              {matches.map((base) => (
                <li key={base.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setQ('');
                      onChange([...draft.bases, { baseId: base.id, price: 0 }]);
                    }}
                  >
                    <span>{base.name}</span>
                    <span className="text-xs text-subtle">
                      {base.itemClass}, level {base.level}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function OptionalCondition({
  label,
  value,
  families,
  onChange,
}: {
  label: string;
  value: ModCondition | undefined;
  families: Parameters<typeof ConditionEditor>[0]['families'];
  onChange: (value: ModCondition | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">{label}</div>
      {value ? (
        <ConditionEditor
          value={value}
          families={families}
          onChange={onChange}
          onRemove={() => onChange(undefined)}
        />
      ) : (
        <Button variant="ghost" onClick={() => onChange({ family: '' })}>
          + Add condition
        </Button>
      )}
    </div>
  );
}

function StepEditor({
  index,
  step,
  recipe,
  families,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  step: Step;
  recipe: Recipe;
  families: Parameters<typeof ConditionEditor>[0]['families'];
  onChange: (step: Step) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const changeKind = (kind: StepKind) => {
    if (kind === step.kind) return;
    const fresh = newStep(kind);
    const action = step.kind === 'loop' ? (step.uses[0]?.action ?? []) : step.action;
    const carried: Step =
      fresh.kind === 'loop'
        ? { ...fresh, uses: [{ action, expectedUses: 10 }] }
        : { ...fresh, action };
    onChange({ ...carried, id: step.id, ...(step.label ? { label: step.label } : {}) });
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-sm text-subtle">{index + 1}.</span>
        <StepKindBadge kind={step.kind} />
        <Select
          aria-label="Step kind"
          value={step.kind}
          onChange={(e) => changeKind(e.target.value as StepKind)}
        >
          {STEP_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label} – {k.hint}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Step label"
          placeholder={stepTitle({ ...step, label: '' }, index)}
          className="min-w-40 flex-1"
          value={step.label ?? ''}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
        />
        <Button
          variant="ghost"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          aria-label="Move down"
          disabled={index === recipe.steps.length - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </Button>
        <Button variant="danger" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {step.kind === 'apply' && (
        <Row>
          <ActionEditor action={step.action} onChange={(action) => onChange({ ...step, action })} />
          <NumberField
            label="Times"
            value={step.times}
            min={1}
            onChange={(times) => onChange({ ...step, times: Math.max(1, times) })}
          />
        </Row>
      )}

      {step.kind === 'best-effort' && (
        <Row>
          <ActionEditor action={step.action} onChange={(action) => onChange({ ...step, action })} />
          <NumberField
            label="Expected uses"
            value={step.expectedUses}
            onChange={(expectedUses) => onChange({ ...step, expectedUses })}
          />
        </Row>
      )}

      {step.kind === 'loop' && (
        <div className="space-y-3">
          {step.uses.map((use, i) => (
            <Row key={i}>
              <ActionEditor
                label={`Action ${i + 1}`}
                action={use.action}
                onChange={(action) =>
                  onChange({
                    ...step,
                    uses: step.uses.map((u, j) => (j === i ? { ...u, action } : u)),
                  })
                }
              />
              <div className="flex items-end gap-2">
                <NumberField
                  label="Expected uses"
                  value={use.expectedUses}
                  onChange={(expectedUses) =>
                    onChange({
                      ...step,
                      uses: step.uses.map((u, j) => (j === i ? { ...u, expectedUses } : u)),
                    })
                  }
                />
                {step.uses.length > 1 && (
                  <Button
                    variant="danger"
                    onClick={() => onChange({ ...step, uses: step.uses.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Row>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              onChange({ ...step, uses: [...step.uses, { action: [], expectedUses: 10 }] })
            }
          >
            + Add action to the loop
          </Button>
          <OptionalCondition
            label="Until"
            value={step.until}
            families={families}
            onChange={(until) => onChange(withOptional(step, 'until', until))}
          />
        </div>
      )}

      {step.kind === 'gate' && (
        <div className="space-y-3">
          <Row>
            <ActionEditor
              action={step.action}
              onChange={(action) => onChange({ ...step, action })}
            />
            <NumberField
              label="Success %"
              value={Math.round(step.successChance * 1000) / 10}
              min={0.1}
              max={100}
              onChange={(pct) =>
                onChange({ ...step, successChance: Math.min(1, Math.max(0.001, pct / 100)) })
              }
            />
          </Row>
          <OptionalCondition
            label="Success means"
            value={step.success}
            families={families}
            onChange={(success) => onChange(withOptional(step, 'success', success))}
          />
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <ActionEditor
              label="On failure, recovery (optional)"
              optional
              action={step.onFail.recovery ?? []}
              onChange={(recovery) =>
                onChange({
                  ...step,
                  onFail: recovery.length
                    ? { ...step.onFail, recovery }
                    : { goto: step.onFail.goto },
                })
              }
            />
            <Field label="Then go back to">
              <Select
                value={step.onFail.goto}
                onChange={(e) =>
                  onChange({ ...step, onFail: { ...step.onFail, goto: e.target.value } })
                }
              >
                <option value={BASE_STEP}>A new base</option>
                {recipe.steps.slice(0, index + 1).map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Step {i + 1}: {stepTitle(s, i)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-3 md:grid-cols-[1fr_auto]">{children}</div>;
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        max={max}
        step="any"
        className="w-28"
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
    </Field>
  );
}

function PriceOverrides({
  draft,
  onChange,
}: {
  draft: Recipe;
  onChange: (overrides: Recipe['priceOverrides']) => void;
}) {
  const { items, unit } = useCatalog();
  const ids = recipeItemIds(cleanRecipe(draft));
  if (!ids.length) return null;
  return (
    <Panel
      title="Prices"
      subtitle="Live exchange prices; type a price to replace one (or fill a missing one)"
    >
      <ul className="divide-y divide-line">
        {ids.map((id) => {
          const live = items.get(id)?.price;
          const manual = draft.priceOverrides[id];
          return (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <ItemName itemId={id} />
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  Live: {live === undefined ? 'no price' : <Amount value={live} unit={unit} />}
                </span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Manual"
                  aria-label="Manual price"
                  className="w-28"
                  value={manual ?? ''}
                  onChange={(e) => {
                    const rest = Object.entries(draft.priceOverrides).filter(([k]) => k !== id);
                    if (e.target.value !== '') {
                      rest.push([id, Math.max(0, Number(e.target.value) || 0)]);
                    }
                    onChange(Object.fromEntries(rest));
                  }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function withOptional<S extends Step, K extends 'until' | 'success'>(
  step: S,
  key: K,
  value: ModCondition | undefined,
): S {
  const rest = Object.fromEntries(Object.entries(step).filter(([k]) => k !== key));
  return (value ? { ...rest, [key]: value } : rest) as S;
}

/** Drops unfinished conditions (no mod picked yet) and empty labels before validation. */
export function cleanRecipe(recipe: Recipe): Recipe {
  const steps = recipe.steps.map((step): Step => {
    const base = step.label?.trim() ? step : withoutLabel(step);
    if (base.kind === 'loop') return withOptional(base, 'until', cleanCondition(base.until));
    if (base.kind === 'gate') return withOptional(base, 'success', cleanCondition(base.success));
    return base;
  });
  const out: Recipe = { ...recipe, name: recipe.name.trim(), steps };
  const baseMods = cleanCondition(recipe.baseMods);
  const target = cleanCondition(recipe.target);
  if (baseMods) out.baseMods = baseMods;
  else delete out.baseMods;
  if (target) out.target = target;
  else delete out.target;
  return out;
}

function withoutLabel(step: Step): Step {
  const next = { ...step };
  delete next.label;
  return next;
}

export function cleanCondition(c: ModCondition | undefined): ModCondition | undefined {
  if (!c) return undefined;
  if ('family' in c) return c.family ? c : undefined;
  const list = ('anyOf' in c ? c.anyOf : 'allOf' in c ? c.allOf : c.of).flatMap((x) => {
    const cleaned = cleanCondition(x);
    return cleaned ? [cleaned] : [];
  });
  if (!list.length) return undefined;
  if ('anyOf' in c) return { anyOf: list };
  if ('allOf' in c) return { allOf: list };
  return { atLeast: Math.min(c.atLeast, list.length), of: list };
}

/** Readable validation message: which step, which field. */
function describeIssue(recipe: Recipe, path: readonly PropertyKey[], message: string): string {
  if (path[0] === 'name') return 'the recipe needs a name';
  if (path[0] === 'steps' && typeof path[1] === 'number') {
    const step = recipe.steps[path[1]];
    const where = step
      ? `step ${path[1] + 1} (${stepTitle(step, path[1])})`
      : `step ${path[1] + 1}`;
    if (path.includes('action') || path.includes('recovery')) return `${where} has no item`;
    return `${where}: ${message}`;
  }
  return message;
}
