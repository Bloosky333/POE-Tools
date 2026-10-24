import { describe, expect, it } from 'vitest';
import { expectedRuns, recipeCost } from './engine.ts';
import { recipeSchema, type RecipeInput } from './recipe.ts';

const PRICES: Record<string, number> = {
  aug: 0.01,
  annul: 1,
  exalted: 0.1,
  fracturing: 5,
  omen: 2,
};
const live = (id: string) => PRICES[id];

function recipe(steps: RecipeInput['steps'], extra: Partial<RecipeInput> = {}) {
  return recipeSchema.parse({
    id: 'r',
    name: 'Test',
    game: 'poe2',
    bases: [{ baseId: 'b', price: 3 }],
    steps,
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...extra,
  });
}

const runsOf = (r: ReturnType<typeof recipe>) => expectedRuns(r.steps).map((p) => p.runs);

describe('expectedRuns', () => {
  it('runs a straight recipe once', () => {
    const r = recipe([
      { id: 'a', kind: 'apply', action: [{ itemId: 'exalted' }] },
      { id: 'b', kind: 'best-effort', action: [{ itemId: 'aug' }], expectedUses: 4 },
    ]);
    expect(runsOf(r)).toEqual([1, 1, 1]);
  });

  it('repeats the steps since the restart point 1/p times', () => {
    const r = recipe([
      { id: 'a', kind: 'apply', action: [{ itemId: 'exalted' }] },
      { id: 'b', kind: 'apply', action: [{ itemId: 'aug' }] },
      {
        id: 'g',
        kind: 'gate',
        action: [{ itemId: 'fracturing' }],
        successChance: 0.25,
        onFail: { goto: 'b', recovery: [{ itemId: 'annul' }] },
      },
      { id: 'c', kind: 'apply', action: [{ itemId: 'exalted' }] },
    ]);
    // base, a, b, gate, recovery, c
    expect(runsOf(r)).toEqual([1, 1, 4, 4, 3, 1]);
  });

  it('re-buys the base when a gate restarts from it', () => {
    const r = recipe([
      { id: 'a', kind: 'apply', action: [{ itemId: 'exalted' }] },
      {
        id: 'g',
        kind: 'gate',
        action: [{ itemId: 'fracturing' }],
        successChance: 0.5,
        onFail: { goto: 'base' },
      },
    ]);
    expect(runsOf(r)).toEqual([2, 2, 2, 1]);
  });

  it('nests gates: an outer retry repeats the inner retries', () => {
    const r = recipe([
      { id: 'a', kind: 'apply', action: [{ itemId: 'aug' }] },
      {
        id: 'g1',
        kind: 'gate',
        action: [{ itemId: 'exalted' }],
        successChance: 0.5,
        onFail: { goto: 'a' },
      },
      {
        id: 'g2',
        kind: 'gate',
        action: [{ itemId: 'fracturing' }],
        successChance: 0.5,
        onFail: { goto: 'base' },
      },
    ]);
    // base, a, g1, rec1, g2, rec2
    expect(runsOf(r)).toEqual([2, 4, 4, 2, 2, 1]);
  });

  it('handles a restart that lands inside an earlier gate’s range', () => {
    const r = recipe([
      { id: 'a', kind: 'apply', action: [{ itemId: 'aug' }] },
      { id: 'b', kind: 'apply', action: [{ itemId: 'aug' }] },
      {
        id: 'g1',
        kind: 'gate',
        action: [{ itemId: 'exalted' }],
        successChance: 0.5,
        onFail: { goto: 'a' },
      },
      {
        id: 'g2',
        kind: 'gate',
        action: [{ itemId: 'exalted' }],
        successChance: 0.5,
        onFail: { goto: 'b' },
      },
    ]);
    // Each g2 attempt redoes b + g1 (whose failures redo a): 2 attempts × 2 a/b per g1 pass.
    const runs = runsOf(r);
    expect(runs[1]).toBeCloseTo(1 + 2 * 1, 9); // a: first pass + one extra per g1 failure
    expect(runs[2]).toBeCloseTo(4, 9);
    expect(runs[3]).toBeCloseTo(4, 9);
    expect(runs[5]).toBeCloseTo(2, 9);
  });
});

describe('recipeCost', () => {
  it('prices loops per expected uses and adds the base', () => {
    const r = recipe([
      {
        id: 'l',
        kind: 'loop',
        uses: [
          { action: [{ itemId: 'aug' }], expectedUses: 30 },
          { action: [{ itemId: 'annul' }], expectedUses: 25 },
        ],
      },
      { id: 'e', kind: 'apply', action: [{ itemId: 'omen' }, { itemId: 'exalted' }] },
    ]);
    const cost = recipeCost(r, 0, live);
    expect(cost.steps.map((s) => s.expected)).toEqual([25.3, 2.1]);
    expect(cost.total).toBeCloseTo(3 + 25.3 + 2.1, 9);
    expect(cost.items.find((i) => i.itemId === 'aug')?.uses).toBe(30);
  });

  it('uses manual prices and reports unpriced items', () => {
    const r = recipe(
      [
        { id: 'a', kind: 'apply', action: [{ itemId: 'mystery' }] },
        { id: 'b', kind: 'apply', action: [{ itemId: 'exalted', count: 2 }] },
        { id: 'c', kind: 'apply', action: [{ itemId: 'rare-omen' }] },
      ],
      { priceOverrides: { 'rare-omen': 7, exalted: 0.5 } },
    );
    const cost = recipeCost(r, 0, live);
    expect(cost.unpriced).toEqual(['mystery']);
    expect(cost.steps.map((s) => s.expected)).toEqual([null, 1, 7]);
    expect(cost.total).toBeCloseTo(11, 9);
  });

  it('counts gate retries and recoveries in the shopping list', () => {
    const r = recipe([
      {
        id: 'g',
        kind: 'gate',
        action: [{ itemId: 'fracturing' }],
        successChance: 0.2,
        onFail: { goto: 'base', recovery: [{ itemId: 'annul' }] },
      },
    ]);
    const cost = recipeCost(r, 0, live);
    expect(cost.base).toEqual({ price: 3, runs: 5, expected: 15 });
    expect(cost.items.find((i) => i.itemId === 'fracturing')?.uses).toBeCloseTo(5, 9);
    expect(cost.items.find((i) => i.itemId === 'annul')?.uses).toBeCloseTo(4, 9);
    expect(cost.total).toBeCloseTo(15 + 25 + 4, 9);
  });
});

describe('recipeSchema', () => {
  it('rejects a gate going forward', () => {
    expect(() =>
      recipe([
        {
          id: 'g',
          kind: 'gate',
          action: [{ itemId: 'x' }],
          successChance: 0.5,
          onFail: { goto: 'later' },
        },
        { id: 'later', kind: 'apply', action: [{ itemId: 'x' }] },
      ]),
    ).toThrow(/earlier one/);
  });
});
