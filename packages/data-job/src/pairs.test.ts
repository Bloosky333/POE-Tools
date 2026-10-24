import { describe, expect, it } from 'vitest';
import {
  buildPairQuotes,
  busiestPairs,
  detailsToPairPoints,
  type BusiestPair,
  type PairPoint,
} from './pairs.ts';
import { exchangeDetailsSchema, exchangeOverviewSchema } from './poe-ninja/schemas.ts';
import { probeJson } from './test/fixtures.ts';

const details = (name: string) =>
  exchangeDetailsSchema.parse(probeJson(`exchange-details-${name}.json`));
const overview = (name: string) =>
  exchangeOverviewSchema.parse(probeJson(`exchange-overview-${name}.json`));

describe('rate directions (probe fixtures)', () => {
  it('details rate is units of the pair currency per item', () => {
    // Chaos Orb vs divine = divine per chaos, matching the core rate (chaos per divine).
    const chaos = details('chaos-orb-runes-of-aldur');
    const rate = chaos.pairs.find((p) => p.id === 'divine')?.history[0]?.rate ?? 0;
    expect(rate * (chaos.core.rates.chaos ?? 0)).toBeCloseTo(1, 2);
    // Divine Orb vs exalted = exalted per divine.
    const divine = details('divine-orb-runes-of-aldur');
    const exalted = divine.pairs.find((p) => p.id === 'exalted')?.history[0]?.rate;
    expect(exalted).toBeCloseTo(divine.core.rates.exalted ?? 0, 0);
  });

  it('overview maxVolumeRate is items per unit of the pair currency', () => {
    for (const line of overview('currency-forbidden-rites').lines) {
      if (line.maxVolumeCurrency !== 'divine' || !line.maxVolumeRate || line.id === 'divine')
        continue;
      // Both are rounded to ~4 significant digits upstream.
      expect(Math.abs(line.maxVolumeRate * line.primaryValue - 1)).toBeLessThan(0.005);
    }
  });
});

describe('detailsToPairPoints', () => {
  it('keeps completed days of each pay currency', () => {
    const points = detailsToPairPoints(
      details('siones-temper-forbidden-rites'),
      'st',
      '2026-10-24',
    );
    expect(new Set(points.map((p) => p.pair))).toEqual(new Set(['divine', 'exalted', 'chaos']));
    expect(points.every((p) => p.date < '2026-10-24' && p.rate > 0)).toBe(true);
    expect(points.find((p) => p.date === '2026-10-23' && p.pair === 'exalted')).toEqual({
      date: '2026-10-23',
      item: 'st',
      pair: 'exalted',
      rate: 110.6,
      volume: 1.25,
    });
  });

  it('skips points without a rate', () => {
    const points = detailsToPairPoints(details('adept-rune-forbidden-rites'), 'ar', '2026-10-24');
    expect(points.every((p) => p.rate > 0)).toBe(true);
  });
});

describe('busiestPairs', () => {
  it('inverts maxVolumeRate to units per item', () => {
    const busiest = busiestPairs([overview('currency-forbidden-rites')]);
    expect(busiest.get('chaos')).toEqual({ pair: 'divine', rate: expect.closeTo(0.1007, 4) });
    // The pay currency itself has no pair against itself.
    expect(busiest.get('divine')?.pair).toBe('chaos');
  });
});

describe('buildPairQuotes', () => {
  const now = new Date('2026-10-24T05:00:00Z');
  const point = (date: string, pair: PairPoint['pair'], rate: number): PairPoint => ({
    date,
    item: 'x',
    pair,
    rate,
    volume: 2,
  });

  it('takes the newest recent day and lets the hourly busiest pair override it', () => {
    const busiest = new Map<string, BusiestPair>([['x', { pair: 'exalted', rate: 90 }]]);
    const items = buildPairQuotes(
      [
        point('2026-10-22', 'divine', 1),
        point('2026-10-23', 'divine', 1.5),
        point('2026-10-23', 'exalted', 100),
        point('2026-10-10', 'chaos', 8),
      ],
      busiest,
      now,
    );
    expect(items.x).toEqual({
      divine: { rate: 1.5, volume: 2, asOf: '2026-10-24T00:00:00.000Z', source: 'daily' },
      exalted: { rate: 90, volume: 2, asOf: now.toISOString(), source: 'hourly' },
    });
  });

  it('publishes items with only an hourly pair', () => {
    const busiest = new Map<string, BusiestPair>([['y', { pair: 'chaos', rate: 3 }]]);
    expect(buildPairQuotes([], busiest, now).y?.chaos).toMatchObject({ volume: null });
  });
});
