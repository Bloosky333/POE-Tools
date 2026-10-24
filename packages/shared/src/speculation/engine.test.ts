import { describe, expect, it } from 'vitest';
import type { CurrentItem, HistoryPoint } from '../site-data.ts';
import { suggest, type SellMode } from './engine.ts';
import { Series } from './series.ts';

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

const horizon = (days: number): SellMode => ({ kind: 'horizon', days });

describe('Series', () => {
  it('interpolates between known days', () => {
    const s = new Series([
      [0, 1, 10],
      [2, 3, 30],
    ]);
    expect(s.priceAt(1)).toBe(2);
    expect(s.volumeAt(1)).toBe(20);
    expect(s.priceAt(3)).toBeNull();
    expect(s.has(1)).toBe(false);
  });
});

describe('suggest', () => {
  const rising = series(60, (day) => 1 + day / 10); // 1 → 7

  it('says BUY NOW when the reference rose enough by the sell day', () => {
    const s = suggest({
      item: item(),
      reference: rising,
      current: rising,
      today: 10,
      mode: horizon(10),
    });
    expect(s.action).toBe('buy');
    expect(s.reference?.sellDay).toBe(20);
    expect(s.reference?.multiplier).toBeCloseTo(3 / 2);
    expect(s.projectedSellPrice).toBeCloseTo(3);
    expect(s.confidence).toBeGreaterThan(70);
    expect(s.score).toBeGreaterThan(0);
  });

  it('says AVOID when the reference fell', () => {
    const falling = series(60, (day) => 10 - day / 10);
    const s = suggest({
      item: item(),
      reference: falling,
      current: falling,
      today: 10,
      mode: horizon(14),
    });
    expect(s.action).toBe('avoid');
  });

  it('says WAIT when a dip comes before the rise', () => {
    // 2 at day 10, dips to 1 at day 15, rises to 4 at day 30.
    const dip = series(60, (day) =>
      day <= 15 ? 2 - Math.max(0, day - 10) / 5 : 1 + (day - 15) / 5,
    );
    const s = suggest({ item: item(), reference: dip, current: dip, today: 10, mode: horizon(20) });
    expect(s.action).toBe('wait');
    expect(s.reference?.buyDay).toBe(15);
    expect(s.reference?.multiplierFromBuy).toBeCloseTo(4);
  });

  it('finds the peak and clips horizons past the reference end', () => {
    const hump = series(40, (day) => 10 - Math.abs(day - 25) / 5);
    const peak = suggest({
      item: item(),
      reference: hump,
      current: hump,
      today: 10,
      mode: { kind: 'peak' },
    });
    expect(peak.reference?.sellDay).toBe(25);
    const clipped = suggest({
      item: item(),
      reference: hump,
      current: hump,
      today: 30,
      mode: horizon(30),
    });
    expect(clipped.reference?.sellDay).toBe(40);
    expect(clipped.reference?.clipped).toBe(true);
  });

  it('is NEUTRAL with zero confidence without reference data', () => {
    const s = suggest({
      item: item(),
      reference: undefined,
      current: rising,
      today: 10,
      mode: horizon(7),
    });
    expect(s).toMatchObject({ action: 'neutral', reference: null, confidence: 0, score: 0 });
  });

  it('does not say BUY NOW on illiquid items', () => {
    const s = suggest({
      item: item({ volume: 1 }),
      reference: rising,
      current: rising,
      today: 10,
      mode: horizon(10),
    });
    expect(s.action).toBe('neutral');
    expect(s.reasons.join(' ')).toMatch(/Low volume/);
  });

  it('lowers confidence when the current league moves against the reference', () => {
    const wiggle = (sign: number) => series(60, (day) => 2 + sign * 0.3 * Math.sin(day));
    const same = suggest({
      item: item(),
      reference: wiggle(1),
      current: wiggle(1),
      today: 20,
      mode: horizon(7),
    });
    const opposite = suggest({
      item: item(),
      reference: wiggle(1),
      current: wiggle(-1),
      today: 20,
      mode: horizon(7),
    });
    expect(same.breakdown.similarity).toBeGreaterThan(0.9);
    expect(opposite.breakdown.similarity).toBeLessThan(0.1);
    expect(opposite.confidence).toBeLessThan(same.confidence);
  });

  it('halves confidence during launch days', () => {
    const early = suggest({
      item: item(),
      reference: rising,
      current: rising,
      today: 2,
      mode: horizon(7),
    });
    expect(early.breakdown.phase).toBe(0.5);
    expect(early.confidence).toBeLessThanOrEqual(50);
  });
});
