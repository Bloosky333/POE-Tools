import type { Recipe } from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import { exportFile, mergeImport, newRecipe, parseImport } from './storage.ts';
import { cleanCondition, cleanRecipe } from './RecipeEditor.tsx';

const recipe = (id: string, updatedAt: string, name = id): Recipe => ({
  ...newRecipe('poe2', new Date(updatedAt)),
  id,
  name,
  steps: [{ id: 's', kind: 'apply', action: [{ itemId: 'exalted', count: 1 }], times: 1 }],
});

describe('import / export', () => {
  it('round-trips an export file', () => {
    const recipes = [recipe('a', '2026-10-01T00:00:00.000Z')];
    expect(parseImport(JSON.stringify(exportFile(recipes)))).toEqual(recipes);
  });

  it('accepts a bare recipe and rejects other files', () => {
    expect(parseImport(JSON.stringify(recipe('a', '2026-10-01T00:00:00.000Z')))).toHaveLength(1);
    expect(() => parseImport('{"hello":1}')).toThrow(/Not a recipe export/);
    expect(() => parseImport('nope')).toThrow(/Not a JSON file/);
  });

  it('keeps the newer copy of a recipe', () => {
    const old = recipe('a', '2026-10-01T00:00:00.000Z', 'old');
    const newer = recipe('a', '2026-10-02T00:00:00.000Z', 'newer');
    expect(mergeImport('poe2', [old], [newer])).toEqual({
      recipes: [newer],
      changed: 1,
      otherGame: 0,
    });
    expect(
      mergeImport('poe2', [newer], [old, recipe('b', '2026-10-01T00:00:00.000Z')]).changed,
    ).toBe(1);
  });

  it('leaves out recipes of the other game', () => {
    const poe1 = { ...recipe('c', '2026-10-01T00:00:00.000Z'), game: 'poe1' as const };
    expect(mergeImport('poe2', [], [poe1])).toEqual({ recipes: [], changed: 0, otherGame: 1 });
    expect(mergeImport('poe1', [], [poe1]).recipes).toEqual([poe1]);
  });
});

describe('cleanRecipe', () => {
  it('drops unfinished conditions and empty labels', () => {
    expect(
      cleanCondition({
        atLeast: 3,
        of: [{ family: 'Life' }, { family: '' }, { anyOf: [{ family: '' }] }],
      }),
    ).toEqual({ atLeast: 1, of: [{ family: 'Life' }] });
    const r = cleanRecipe({
      ...recipe('a', '2026-10-01T00:00:00.000Z'),
      target: { family: '' },
      steps: [{ id: 's', kind: 'loop', label: ' ', until: { anyOf: [{ family: '' }] }, uses: [] }],
    });
    expect(r.target).toBeUndefined();
    expect(r.steps[0]).toEqual({ id: 's', kind: 'loop', uses: [] });
  });
});
