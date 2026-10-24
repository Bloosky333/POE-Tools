import {
  BASE_STEP,
  type CraftAction,
  type Recipe,
  type Step,
  type StepKind,
} from '@poe-tools/shared';
import { Badge, type BadgeTone } from '../../ui/index.ts';
import { useCatalog } from './catalog.ts';

export const STEP_KINDS: { value: StepKind; label: string; hint: string }[] = [
  { value: 'apply', label: 'Apply', hint: 'Use once (or n times) and move on' },
  { value: 'loop', label: 'Loop', hint: 'Repeat until the wanted mods are there' },
  { value: 'gate', label: 'Gate', hint: 'Try once; on failure go back to a step' },
  { value: 'best-effort', label: 'Best effort', hint: 'Use about n times, no target' },
];

const KIND_BADGE: Record<StepKind, { tone: BadgeTone; icon: string }> = {
  apply: { tone: 'neutral', icon: '→' },
  loop: { tone: 'accent', icon: '↻' },
  gate: { tone: 'warn', icon: '⑂' },
  'best-effort': { tone: 'neutral', icon: '≈' },
};

export function StepKindBadge({ kind }: { kind: StepKind }) {
  const { tone, icon } = KIND_BADGE[kind];
  return (
    <Badge tone={tone} icon={icon}>
      {STEP_KINDS.find((k) => k.value === kind)?.label}
    </Badge>
  );
}

/** Item icon + name; unknown ids (item gone from the exchange) shown as their id. */
export function ItemName({ itemId, count }: { itemId: string; count?: number | undefined }) {
  const { items } = useCatalog();
  const item = items.get(itemId);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {item?.icon && <img src={item.icon} alt="" width={20} height={20} className="h-5 w-5" />}
      <span className="truncate">{item?.name ?? itemId}</span>
      {count !== undefined && count !== 1 && <span className="text-subtle">×{count}</span>}
    </span>
  );
}

/** Items of an action joined by `+`. */
export function ActionView({ action }: { action: CraftAction }) {
  if (!action.length) return <span className="text-subtle">No item</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {action.map((use, i) => (
        <span key={`${use.itemId}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-subtle">+</span>}
          <ItemName itemId={use.itemId} count={use.count} />
        </span>
      ))}
    </span>
  );
}

/** Default step title: its label, or a short reading of the kind. */
export function stepTitle(step: Step, index: number): string {
  return (
    step.label?.trim() || `${STEP_KINDS.find((k) => k.value === step.kind)?.label} ${index + 1}`
  );
}

/** Where a failed gate goes back to, readable. */
export function gotoLabel(recipe: Recipe, goto: string): string {
  if (goto === BASE_STEP) return 'new base';
  const index = recipe.steps.findIndex((s) => s.id === goto);
  const step = recipe.steps[index];
  return step ? `step ${index + 1} (${stepTitle(step, index)})` : 'unknown step';
}
