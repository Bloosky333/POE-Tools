import { describe, expect, it } from 'vitest';
import type { CraftingBase, CraftingMod } from './data.ts';
import { describeCondition, genericText, modFamilies, modText } from './mods.ts';

const mod = (
  id: string,
  family: string,
  level: number,
  weights: [string, number][],
): CraftingMod => ({
  id,
  name: id,
  family,
  kind: 'prefix',
  level,
  text: `+(${level}-${level + 9}) to maximum Life`,
  weights,
});
const base = (tags: string[]): CraftingBase => ({
  id: 'b',
  name: 'B',
  itemClass: 'Ring',
  level: 1,
  tags,
});

describe('modFamilies', () => {
  const mods = [
    mod('Life1', 'Life', 1, [
      ['ring', 1000],
      ['default', 0],
    ]),
    mod('Life2', 'Life', 40, [
      ['ring', 1000],
      ['default', 0],
    ]),
    mod('Life3', 'Life', 80, [
      ['body_armour', 100],
      ['default', 0],
    ]),
    mod('Ammo', 'Ammo', 1, [
      ['crossbow', 1],
      ['default', 0],
    ]),
  ];

  it('ranks tiers for the base, best first, using the first matching tag', () => {
    const families = modFamilies(mods, [base(['ring', 'default'])]);
    expect(families.map((f) => f.family)).toEqual(['Life']);
    expect(families[0]?.tiers.map((t) => t.id)).toEqual(['Life2', 'Life1']);
  });

  it('keeps every family without a base', () => {
    expect(modFamilies(mods).map((f) => f.family)).toEqual(['Life', 'Ammo']);
  });
});

describe('mod text', () => {
  it('strips link markup and collapses ranges', () => {
    expect(modText('[Allies|Allies] in your [Presence|Presence] gain [Onslaught]')).toBe(
      'Allies in your Presence gain Onslaught',
    );
    expect(genericText('+(10-19) to maximum Life')).toBe('+# to maximum Life');
    expect(genericText('Adds (3-5) to (8-10) Fire Damage')).toBe('Adds # to # Fire Damage');
  });

  it('reads conditions', () => {
    expect(
      describeCondition({
        anyOf: [
          { family: 'Life', tier: 1 },
          { atLeast: 2, of: [{ family: 'A' }, { family: 'B', tier: 2 }] },
        ],
      }),
    ).toBe('T1 Life or (2 of: A, T1–T2 B)');
  });
});
