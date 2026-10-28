import type { CurrentItem, Flip, FlipLeg } from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, filterAndSort, toRatio, toRows } from './logic.ts';

const leg = (hub: FlipLeg['hub'], units: number, value: number): FlipLeg => ({
  hub,
  avg: 1,
  low: 1,
  high: 1,
  units24h: units,
  value24h: value,
});

const flip = (id: string, overrides: Partial<Flip> = {}): Flip => ({
  id,
  kind: 'cross',
  item: id,
  buy: leg('exalted', 1000, 500),
  sell: leg('divine', 1000, 500),
  convert: { from: 'divine', to: 'exalted', avg: 700, best: 710 },
  margin: 0.1,
  bestMargin: 0.3,
  units24h: 1000,
  value24h: 500,
  hourly: [0.1, 0.1, null, 0.01],
  ...overrides,
});

const item = (id: string, type: CurrentItem['type'] = 'Currency'): CurrentItem => ({
  id,
  detailsId: id,
  name: id.toUpperCase(),
  icon: '',
  type,
  price: 1,
  volume: 1,
  change7d: null,
});

describe('toRatio', () => {
  it('finds the small integer ratio players type in-game', () => {
    expect(toRatio(10)).toEqual([10, 1]);
    expect(toRatio(0.25)).toEqual([1, 4]);
    expect(toRatio(1.5)).toEqual([3, 2]);
    expect(toRatio(378 / 5)).toEqual([378, 5]);
  });

  it('keeps both terms within the limit, except one side of an extreme price', () => {
    expect(toRatio(1 / 3000)).toEqual([1, 3000]);
    expect(toRatio(2500)).toEqual([2500, 1]);
    const [h, i] = toRatio(Math.PI, 100);
    expect(h).toBeLessThanOrEqual(100);
    expect([h, i]).toEqual([22, 7]);
  });
});

describe('filterAndSort', () => {
  const items = new Map([
    ['a', item('a')],
    ['b', item('b', 'Ritual')],
    ['c', item('c')],
  ]);
  const rows = toRows(
    [
      flip('a', { margin: 0.05 }),
      flip('b', { margin: 0.2, kind: 'spread' }),
      flip('c', { margin: 0.5, value24h: 50 }),
    ],
    items,
    DEFAULTS.minMargin,
  );

  it('computes recurrence over the window with the margin threshold', () => {
    expect(rows[0]?.recurrence).toBe(50);
  });

  it('filters on every leg minimum and sorts by margin', () => {
    expect(filterAndSort(rows, DEFAULTS).map((r) => r.flip.id)).toEqual(['b', 'a']);
    expect(filterAndSort(rows, { ...DEFAULTS, minValue: 0 }).map((r) => r.flip.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('filters on kind, category, search and recurrence', () => {
    expect(filterAndSort(rows, { ...DEFAULTS, kind: 'cross' }).map((r) => r.flip.id)).toEqual([
      'a',
    ]);
    expect(filterAndSort(rows, { ...DEFAULTS, type: 'Ritual' }).map((r) => r.flip.id)).toEqual([
      'b',
    ]);
    expect(filterAndSort(rows, { ...DEFAULTS, q: 'A' }).map((r) => r.flip.id)).toEqual(['a']);
    expect(filterAndSort(rows, { ...DEFAULTS, minRecurrence: 75 })).toEqual([]);
  });
});
