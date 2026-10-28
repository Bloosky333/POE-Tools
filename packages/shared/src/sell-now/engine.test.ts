import { describe, expect, it } from 'vitest';
import type { CurrentItem, HistoryPoint } from '../site-data.ts';
import { ECONOMY } from '../games.ts';
import {
  marketChanges as marketChangesIn,
  sellSettingsFor,
  sellSignal as sellSignalWith,
  type SellInput,
} from './engine.ts';

/** PoE 2 settings and market scope. */
const sellSignal = (input: Omit<SellInput, 'settings'>) =>
  sellSignalWith({ settings: sellSettingsFor('poe2'), ...input });
const marketChanges = (
  ...args: [SellInput['item'][], Parameters<typeof marketChangesIn>[1], number]
) => marketChangesIn(...args, ECONOMY.poe2);

const item = (overrides: Partial<CurrentItem> = {}): CurrentItem => ({
  id: 'x',
  detailsId: 'x',
  name: 'X',
  icon: '',
  type: 'Currency',
  price: 2,
  volume: 100,
  change7d: null,
  ...overrides,
});

/** Daily series from a price function, days 0..last, volume 100. */
const series = (last: number, price: (day: number) => number): HistoryPoint[] =>
  Array.from({ length: last + 1 }, (_, day) => [day, price(day), 100]);

const flat = series(60, () => 2);
/** Rises to day 20, then halves by day 34. */
const peakAt20 = series(60, (day) => (day <= 20 ? 1 + day / 20 : Math.max(1, 2 - (day - 20) / 14)));

describe('sellSignal', () => {
  it('says SELL NOW when last league peaked today and then declined', () => {
    const s = sellSignal({ item: item(), reference: peakAt20, current: peakAt20, today: 20 });
    expect(s.verdict).toBe('sell-now');
    expect(s.signals).toEqual(['peak']);
    expect(s.reference?.peakDay).toBe(20);
    expect(s.reference?.change).toBeCloseTo(0.5);
    expect(s.expectedLoss).toBeCloseTo(0.5);
    expect(s.score).toBeGreaterThan(0);
    expect(s.sellDay).toBe(20);
  });

  it('says SELL SOON when the reference peak is a few days ahead', () => {
    const s = sellSignal({ item: item(), reference: peakAt20, current: peakAt20, today: 16 });
    expect(s.verdict).toBe('sell-soon');
    expect(s.sellDay).toBe(20);
    expect(s.reference?.peakDay).toBe(20);
  });

  it('holds when the reference keeps rising', () => {
    const rising = series(60, (day) => 1 + day / 10);
    const s = sellSignal({ item: item(), reference: rising, current: rising, today: 20 });
    expect(s.verdict).toBe('hold');
    expect(s.signals).toEqual([]);
    expect(s.score).toBe(0);
  });

  it('flags a 7-day fall only when last league did not recover', () => {
    const crashed = series(30, (day) => (day < 24 ? 2 : 1.5));
    const now = item({ price: 1.5 });
    const declining = series(60, (day) => 2 - day / 100);
    const falling = sellSignal({ item: now, reference: declining, current: crashed, today: 30 });
    expect(falling.verdict).toBe('sell-now');
    expect(falling.signals).toEqual(['falling']);
    expect(falling.change[7]).toBeCloseTo(-0.25);

    const recovering = series(60, (day) => 1 + day / 10);
    const rebound = sellSignal({ item: now, reference: recovering, current: crashed, today: 30 });
    expect(rebound.verdict).toBe('hold');
  });

  it('ignores drops below the 7-day threshold, however sudden', () => {
    const dip = series(30, (day) => (day < 30 ? 2 : 1.8));
    const s = sellSignal({ item: item({ price: 1.8 }), reference: flat, current: dip, today: 30 });
    expect(s.change[1]).toBeCloseTo(-0.1);
    expect(s.verdict).toBe('hold');
  });

  it('measures changes against the market when given', () => {
    const rising = series(30, (day) => 1 + day / 30);
    const s = sellSignal({
      item: item({ price: 2 }),
      reference: flat,
      current: rising,
      today: 30,
      market: { 1: 0, 3: 0.1, 7: 0 },
    });
    expect(s.change[3]).toBeCloseTo(2 / (1 + 27 / 30) - 1);
    expect(s.adjustedChange[3]).toBeCloseTo(2 / (1 + 27 / 30) / 1.1 - 1);
    expect(s.fromHigh).toBe(1);
  });

  it('works without reference data', () => {
    const s = sellSignal({ item: item(), reference: undefined, current: flat, today: 30 });
    expect(s.verdict).toBe('hold');
    expect(s.reference).toBeNull();
    expect(s.reasons).toContain('No reference data for this day');
  });

  it('halves confidence during league launch', () => {
    const s = sellSignal({ item: item(), reference: peakAt20, current: peakAt20, today: 2 });
    expect(s.breakdown.phase).toBe(0.5);
  });
});

describe('marketChanges', () => {
  it('is the median change of liquid items, null with too few items', () => {
    const items = Array.from({ length: 11 }, (_, i) => item({ id: `i${i}`, price: 1.1 }));
    const history = Object.fromEntries(items.map((i) => [i.id, series(10, () => 1)]));
    const m = marketChanges(items, history, 10);
    expect(m[1]).toBeCloseTo(0.1);
    expect(m[7]).toBeCloseTo(0.1);
    expect(marketChanges(items.slice(0, 3), history, 10)[1]).toBeNull();
  });
});
