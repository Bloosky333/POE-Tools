import { describe, expect, it } from 'vitest';
import type { CurrentItem, ExchangeType, HistoryPoint } from '../site-data.ts';
import {
  cappedShares,
  farmSettingsFor,
  farmSignals,
  type FarmSettings,
  type FarmSignal,
} from './engine.ts';
import { farmRole } from './mechanics.ts';

const item = (id: string, type: ExchangeType, price: number, volume = 100): CurrentItem => ({
  id,
  detailsId: id,
  name: id,
  icon: '',
  type,
  price,
  volume,
  change7d: null,
});

/** Daily series from a price function, days 0..last. */
const series = (last: number, price: (day: number) => number, volume = 100): HistoryPoint[] =>
  Array.from({ length: last + 1 }, (_, day) => [day, price(day), volume]);

const TODAY = 20;

/** A flat market of general loot (12 items), the same in both leagues. */
function world(
  extra: { item: CurrentItem; current: HistoryPoint[]; reference: HistoryPoint[] }[],
  settings?: FarmSettings,
) {
  const items: CurrentItem[] = [];
  const currentHistory: Record<string, HistoryPoint[]> = {};
  const referenceHistory: Record<string, HistoryPoint[]> = {};
  for (let i = 0; i < 12; i++) {
    const id = `gem-${i}`;
    items.push(item(id, 'UncutGems', 1));
    currentHistory[id] = series(TODAY - 1, () => 1);
    referenceHistory[id] = series(60, () => 1);
  }
  for (const e of extra) {
    items.push(e.item);
    currentHistory[e.item.id] = e.current;
    referenceHistory[e.item.id] = e.reference;
  }
  return farmSignals({
    game: 'poe2',
    items,
    currentHistory,
    referenceHistory,
    today: TODAY,
    settings,
  });
}

const byMechanic = (signals: FarmSignal[], mechanic: string | null) => {
  const s = signals.find((x) => x.mechanic === mechanic);
  if (!s) throw new Error(`no ${mechanic}`);
  return s;
};

describe('farmRole', () => {
  it('maps categories and name overrides', () => {
    expect(farmRole('poe2', { type: 'Breach', name: 'Catalyst' })).toEqual({
      kind: 'mechanic',
      mechanic: 'Breach',
    });
    expect(farmRole('poe2', { type: 'Fragments', name: 'Simulacrum Splinter' })).toEqual({
      kind: 'mechanic',
      mechanic: 'Delirium',
    });
    expect(farmRole('poe2', { type: 'Fragments', name: 'Cowardly Fate' })).toEqual({
      kind: 'mechanic',
      mechanic: 'Ultimatum',
    });
    expect(farmRole('poe2', { type: 'Fragments', name: "Xesht's Reliquary Key" })).toEqual({
      kind: 'mechanic',
      mechanic: 'Bosses',
    });
    expect(farmRole('poe2', { type: 'Idols', name: 'Cat Idol' }).kind).toBe('ignored');
    expect(farmRole('poe2', { type: 'Runes', name: 'Adept Rune' }).kind).toBe('any');
    expect(farmRole('poe1', { type: 'Scarab', name: 'Breach Scarab' }).kind).toBe('input');
    expect(farmRole('poe1', { type: 'Fragment', name: 'Timeless Maraketh Emblem' })).toEqual({
      kind: 'mechanic',
      mechanic: 'Legion',
    });
  });

  it('gives an unmapped category its own row', () => {
    expect(farmRole('poe1', { type: 'Ducat', name: "Brinehook's Ducat" })).toEqual({
      kind: 'mechanic',
      mechanic: 'Ducats',
    });
  });
});

describe('farmSignals', () => {
  it('says FARM & HOLD when last league its loot rose vs the market', () => {
    const s = byMechanic(
      world([
        {
          item: item('cat', 'Breach', 2),
          current: series(TODAY - 1, () => 2),
          reference: series(60, (d) => (d <= TODAY ? 2 : 2 + (d - TODAY) / 14)),
        },
      ]),
      'Breach',
    );
    expect(s.verdict).toBe('farm-hold');
    expect(s.outlook).toBeCloseTo(1.5);
    expect(s.outlookDay).toBe(TODAY + 14);
    expect(s.trend).toBeCloseTo(1);
    expect(s.marketSize).toBe(100);
    expect(s.lootValue).toBe(2);
    expect(s.index.current.at(-1)).toEqual([TODAY, 1, 0]);
    expect(s.index.reference.find((p) => p[0] === TODAY + 14)?.[1]).toBeCloseTo(1.5);
  });

  it('says AVOID when last league its loot fell', () => {
    const s = byMechanic(
      world([
        {
          item: item('emotion', 'Delirium', 2),
          current: series(TODAY - 1, () => 2),
          reference: series(60, (d) => (d <= TODAY ? 2 : 1)),
        },
      ]),
      'Delirium',
    );
    expect(s.verdict).toBe('avoid');
    expect(s.outlook).toBeCloseTo(0.5);
  });

  it('says AVOID when falling now and last league did not recover, if enabled', () => {
    const extra = [
      {
        item: item('omen', 'Ritual', 2),
        current: series(TODAY - 1, (d) => 4 - (2 * d) / (TODAY - 1)),
        reference: series(60, () => 2),
      },
    ];
    expect(byMechanic(world(extra), 'Ritual').verdict).toBe('farm-sell');
    const s = byMechanic(world(extra, { ...farmSettingsFor('poe2'), fallDrop: 0.15 }), 'Ritual');
    expect(s.trend).toBeLessThan(0.85);
    expect(s.verdict).toBe('avoid');
  });

  it('says FARM & SELL when flat and liquid, THIN when little trades', () => {
    const signals = world([
      {
        item: item('omen', 'Ritual', 2, 100),
        current: series(TODAY - 1, () => 2),
        reference: series(60, () => 2),
      },
      {
        item: item('bone', 'Abyss', 2, 10),
        current: series(TODAY - 1, () => 2, 10),
        reference: series(60, () => 2, 10),
      },
    ]);
    expect(byMechanic(signals, 'Ritual').verdict).toBe('farm-sell');
    expect(byMechanic(signals, 'Abyss').verdict).toBe('thin');
  });

  it('puts general loot in the baseline row and leaves out ignored items', () => {
    const signals = world([
      {
        item: item('idol', 'Idols', 2),
        current: series(TODAY - 1, () => 2),
        reference: series(60, () => 2),
      },
    ]);
    const baseline = byMechanic(signals, null);
    expect(baseline.verdict).toBeNull();
    expect(baseline.items).toHaveLength(12);
    expect(signals.some((s) => s.items.some((f) => f.item.id === 'idol'))).toBe(false);
  });

  it('caps the weight of a dominant item', () => {
    const s = byMechanic(
      world([
        {
          item: item('big', 'Breach', 2, 1000),
          current: series(TODAY - 1, () => 2, 1000),
          reference: series(60, () => 2),
        },
        ...['a', 'b'].map((id) => ({
          item: item(id, 'Breach', 2, 10),
          current: series(TODAY - 1, () => 2, 10),
          reference: series(60, () => 2),
        })),
      ]),
      'Breach',
    );
    s.items.forEach((f, i) => expect(f.share).toBeCloseTo(i ? 0.3 : 0.4));
    expect(s.items[0]?.item.id).toBe('big');
    expect(s.reasons.join(' ')).toContain('big trades 98 % of its volume');
  });

  it('measures completeness on uncapped volume with reference history', () => {
    const s = byMechanic(
      world([
        {
          item: item('big', 'Breach', 2, 1000),
          current: series(TODAY - 1, () => 2, 1000),
          reference: [], // new this league
        },
        ...['a', 'b'].map((id) => ({
          item: item(id, 'Breach', 2, 10),
          current: series(TODAY - 1, () => 2, 10),
          reference: series(60, () => 2),
        })),
      ]),
      'Breach',
    );
    // Capped shares would say 60 % is covered; by volume it is 20 / 1020.
    expect(s.breakdown.completeness).toBeCloseTo(20 / 1020);
  });

  it('gives no trend or outlook when the market move cannot be measured', () => {
    const signals = farmSignals({
      game: 'poe2',
      items: [item('cat', 'Breach', 2)],
      currentHistory: { cat: series(TODAY - 1, () => 2) },
      referenceHistory: { cat: series(60, (d) => (d <= TODAY ? 2 : 4)) },
      today: TODAY,
    });
    const s = byMechanic(signals, 'Breach');
    expect(s.trend).toBeNull();
    expect(s.outlook).toBeNull();
    expect(s.verdict).toBe('farm-sell');
    expect(s.reasons.join(' ')).toMatch(/Too few items/);
  });

  it('caps shares, or splits evenly when the cap is impossible', () => {
    cappedShares([10, 1, 1, 1], 0.4).forEach((x, i) => expect(x).toBeCloseTo(i ? 0.2 : 0.4));
    expect(cappedShares([3, 1], 0.4)).toEqual([0.5, 0.5]);
    expect(cappedShares([1, 1, 1], 0.4).every((x) => Math.abs(x - 1 / 3) < 1e-9)).toBe(true);
  });
});
