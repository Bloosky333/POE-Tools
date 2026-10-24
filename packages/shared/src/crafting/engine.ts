import { BASE_STEP, type CraftAction, type Recipe, type Step } from './recipe.ts';

/*
 * Expected cost of a recipe (spec 08 §3). Every step is a "pass" with a fixed item list; a
 * gate with success chance `p` that restarts from step X repeats the passes from X on
 * average `1 / p` times (geometric retries) and pays its recovery `(1 − p) / p` times.
 * Expected costs are linear in the pass costs, so the engine first works out how many
 * times each pass runs on average, then prices them: the same numbers give the shopping
 * list (expected uses per item).
 */

/** What is paid once per pass: the base, a step, or a gate's recovery. */
export type Pass =
  { kind: 'base' } | { kind: 'step'; stepIndex: number } | { kind: 'recovery'; stepIndex: number };

export interface PassRuns {
  pass: Pass;
  /** Expected number of times the pass is paid. */
  runs: number;
}

/**
 * Expected runs of every pass: the base, each step, and each gate's recovery. Steps after
 * a gate run once per success of that gate; retries of earlier gates nest.
 */
export function expectedRuns(steps: readonly Step[]): PassRuns[] {
  const passes: Pass[] = [{ kind: 'base' }];
  const stepSlot: number[] = [];
  const recoverySlot: number[] = [];
  steps.forEach((step, stepIndex) => {
    stepSlot.push(passes.push({ kind: 'step', stepIndex }) - 1);
    recoverySlot.push(step.kind === 'gate' ? passes.push({ kind: 'recovery', stepIndex }) - 1 : -1);
  });
  const unit = (index: number): number[] => passes.map((_, i) => (i === index ? 1 : 0));
  const add = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] ?? 0));
  const scale = (a: number[], k: number) => a.map((v) => v * k);

  // `before[i]`: expected runs of every pass to stand right before step i (base bought).
  // Restarting from the base means standing before the base purchase: nothing paid.
  const zero = passes.map(() => 0);
  const before: number[][] = [];
  let current = unit(0);
  steps.forEach((step, stepIndex) => {
    before.push(current);
    const pass = unit(stepSlot[stepIndex] ?? -1);
    if (step.kind !== 'gate') {
      current = add(current, pass);
      return;
    }
    const p = step.successChance;
    const target = step.onFail.goto;
    const restartIndex = target === BASE_STEP ? -1 : steps.findIndex((s) => s.id === target);
    const restart = (restartIndex < 0 ? undefined : before[restartIndex]) ?? zero;
    const attempt = add(add(current, scale(restart, -1)), pass);
    const recovery = unit(recoverySlot[stepIndex] ?? -1);
    current = add(add(restart, scale(attempt, 1 / p)), scale(recovery, (1 - p) / p));
  });
  return passes.map((pass, i) => ({ pass, runs: current[i] ?? 0 }));
}

/** Items paid by one pass of a step (without a gate's recovery). */
export function stepItems(step: Step): CraftAction {
  switch (step.kind) {
    case 'apply':
      return step.action.map((u) => ({ itemId: u.itemId, count: u.count * step.times }));
    case 'loop':
      return step.uses.flatMap((u) =>
        u.action.map((a) => ({ itemId: a.itemId, count: a.count * u.expectedUses })),
      );
    case 'gate':
      return step.action;
    case 'best-effort':
      return step.action.map((u) => ({ itemId: u.itemId, count: u.count * step.expectedUses }));
  }
}

export interface ItemTotal {
  itemId: string;
  /** Expected uses over the whole craft. */
  uses: number;
  /** Divine per item, null when unpriced. */
  price: number | null;
  /** Expected cost, null when unpriced. */
  cost: number | null;
  manual: boolean;
}

export interface StepCost {
  stepIndex: number;
  /** Cost of one pass (recovery not included); null when an item is unpriced. */
  passCost: number | null;
  /** Expected passes. */
  runs: number;
  /** Gate only: expected recoveries and the cost of one. */
  recoveryRuns?: number;
  recoveryCost?: number | null;
  /** Expected cost of this step over the craft (passes + recoveries). */
  expected: number | null;
}

export interface RecipeCost {
  base: { price: number; runs: number; expected: number } | null;
  steps: StepCost[];
  items: ItemTotal[];
  /** Base + every priced step. */
  total: number;
  /** Item ids without a live or manual price (the total leaves them out). */
  unpriced: string[];
}

/** Live price lookup: divine per item, undefined when the item has no price. */
export type PriceLookup = (itemId: string) => number | undefined;

export function recipeCost(recipe: Recipe, baseIndex: number, livePrice: PriceLookup): RecipeCost {
  const priceOf = (itemId: string): { price: number | null; manual: boolean } => {
    const manual = recipe.priceOverrides[itemId];
    if (manual !== undefined) return { price: manual, manual: true };
    const live = livePrice(itemId);
    return { price: live ?? null, manual: false };
  };
  const actionCost = (action: CraftAction): number | null => {
    let sum = 0;
    for (const use of action) {
      const { price } = priceOf(use.itemId);
      if (price === null) return null;
      sum += price * use.count;
    }
    return sum;
  };

  const runs = expectedRuns(recipe.steps);
  const baseOption = recipe.bases[baseIndex];
  const baseRuns = runs.find((r) => r.pass.kind === 'base')?.runs ?? 1;
  const base = baseOption
    ? { price: baseOption.price, runs: baseRuns, expected: baseOption.price * baseRuns }
    : null;

  const uses = new Map<string, number>();
  const addUses = (action: CraftAction, times: number) => {
    for (const use of action) uses.set(use.itemId, (uses.get(use.itemId) ?? 0) + use.count * times);
  };

  const steps: StepCost[] = recipe.steps.map((step, stepIndex) => {
    const stepRuns =
      runs.find((r) => r.pass.kind === 'step' && r.pass.stepIndex === stepIndex)?.runs ?? 0;
    const items = stepItems(step);
    addUses(items, stepRuns);
    const passCost = actionCost(items);
    let expected = passCost === null ? null : passCost * stepRuns;
    const cost: StepCost = { stepIndex, passCost, runs: stepRuns, expected };
    if (step.kind === 'gate') {
      const recoveryRuns =
        runs.find((r) => r.pass.kind === 'recovery' && r.pass.stepIndex === stepIndex)?.runs ?? 0;
      const recovery = step.onFail.recovery ?? [];
      addUses(recovery, recoveryRuns);
      const recoveryCost = actionCost(recovery);
      expected =
        expected === null || recoveryCost === null ? null : expected + recoveryCost * recoveryRuns;
      Object.assign(cost, { recoveryRuns, recoveryCost, expected });
    }
    return cost;
  });

  const items: ItemTotal[] = [...uses].map(([itemId, n]) => {
    const { price, manual } = priceOf(itemId);
    return { itemId, uses: n, price, cost: price === null ? null : price * n, manual };
  });
  const unpriced = items.filter((i) => i.price === null).map((i) => i.itemId);
  const total = (base?.expected ?? 0) + items.reduce((sum, i) => sum + (i.cost ?? 0), 0);
  return { base, steps, items, total, unpriced };
}
