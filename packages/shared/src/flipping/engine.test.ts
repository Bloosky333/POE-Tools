import { describe, expect, it } from 'vitest';
import type { Hub } from './data.ts';
import {
  computeFlips,
  marketSides,
  recurrence,
  type ExchangeHour,
  type MarketHour,
} from './engine.ts';

const NOW = new Date('2026-10-24T06:17:00Z');

/** A market with `units` items traded at an average of `avg` hub per item. */
const market = (
  item: string,
  hub: Hub,
  avg: number,
  units: number,
  range: [number, number] = [avg, avg],
): MarketHour => ({
  item,
  hub,
  itemVolume: units,
  hubVolume: avg * units,
  low: range[0],
  high: range[1],
});

/** Hub markets: 1 div = 700 ex = 10 c, 1 c = 70 ex. */
const hubs = (): MarketHour[] => [
  market('exalted', 'divine', 1 / 700, 700_000, [1 / 710, 1 / 690]),
  market('chaos', 'divine', 0.1, 500_000, [1 / 10, 1 / 9]),
  market('chaos', 'exalted', 70, 10_000),
];

const hour = (epoch: number, markets: MarketHour[]): ExchangeHour => ({
  epoch,
  markets: [...hubs(), ...markets],
});

describe('marketSides', () => {
  it('puts the higher-ranked hub on the hub side', () => {
    expect(marketSides('chaos', 'divine')).toEqual({ item: 'chaos', hub: 'divine' });
    expect(marketSides('exalted', 'chaos')).toEqual({ item: 'chaos', hub: 'exalted' });
  });
});

describe('computeFlips', () => {
  it('finds a cross-pair flip from average prices, best direction only', () => {
    // X: 0.05 div in the divine market, 30 ex (≈ 0.0429 div) in the exalted market.
    const file = computeFlips(
      'fr',
      [hour(0, [market('x', 'divine', 0.05, 1000), market('x', 'exalted', 30, 1000, [28, 32])])],
      NOW,
    );
    const cross = file.flips.filter((f) => f.kind === 'cross');
    expect(cross).toHaveLength(1);
    const [flip] = cross;
    expect(flip?.buy.hub).toBe('exalted');
    expect(flip?.sell.hub).toBe('divine');
    // Sell 1 X for 0.05 div → 35 ex; paid 30 ex.
    expect(flip?.margin).toBeCloseTo(35 / 30 - 1, 4);
    expect(flip?.convert).toEqual({ from: 'divine', to: 'exalted', avg: 700, best: 710 });
    // Best case: buy at 28 ex, sell at 0.05 div, convert at 710 ex/div.
    expect(flip?.bestMargin).toBeCloseTo((0.05 * 710) / 28 - 1, 4);
    expect(flip?.units24h).toBe(1000);
    expect(flip?.value24h).toBeCloseTo((30 * 1000) / 700, 4);
  });

  it('converts through the direct hub market, in both directions', () => {
    // X: 1 c (0.1 div) in the chaos market, 0.12 div in the divine market.
    const file = computeFlips(
      'fr',
      [hour(0, [market('x', 'chaos', 1, 1000), market('x', 'divine', 0.12, 1000)])],
      NOW,
    );
    const flip = file.flips.find((f) => f.kind === 'cross');
    expect(flip?.buy.hub).toBe('chaos');
    expect(flip?.convert).toEqual({ from: 'divine', to: 'chaos', avg: 10, best: 10 });
    expect(flip?.margin).toBeCloseTo(0.2, 6);
  });

  it('measures spreads from the hour range and drops outliers', () => {
    const file = computeFlips(
      'fr',
      [
        hour(0, [
          market('x', 'exalted', 30, 1000, [25, 30]),
          market('y', 'exalted', 30, 1000, [10, 40]),
        ]),
      ],
      NOW,
    );
    // Hub markets have spreads too (chaos 9–10 per divine): only look at x and y.
    const spreads = file.flips.filter((f) => f.kind === 'spread' && f.item.length === 1);
    expect(spreads.map((f) => f.item)).toEqual(['x']);
    expect(spreads[0]?.margin).toBeCloseTo(0.2, 6);
    expect(spreads[0]?.buy).toEqual(spreads[0]?.sell);
  });

  it('skips flips whose thinnest leg traded too little value', () => {
    const file = computeFlips(
      'fr',
      [hour(0, [market('x', 'divine', 0.05, 10), market('x', 'exalted', 30, 1000)])],
      NOW,
    );
    // Divine leg: 0.5 div < 10 div.
    expect(file.flips.filter((f) => f.item === 'x')).toEqual([]);
  });

  it('aligns hourly margins on the window and only lists flips of the newest hour', () => {
    const h = 3600;
    const x = (exalted: number) => [
      market('x', 'divine', 0.05, 1000),
      market('x', 'exalted', exalted, 1000),
    ];
    const file = computeFlips(
      'fr',
      [
        hour(0, x(30)),
        hour(h, [market('x', 'divine', 0.05, 1000)]), // exalted leg did not trade
        hour(2 * h, x(35)),
        hour(3 * h, [...x(25), market('gone', 'divine', 1, 1000, [1, 2])]),
      ],
      NOW,
    );
    expect(file.hours).toEqual([0, h, 2 * h, 3 * h]);
    const flip = file.flips.find((f) => f.id === 'cross:x:exalted:divine');
    expect(flip?.hourly).toEqual([0.166667, null, 0, 0.4]);
    expect(recurrence(flip?.hourly ?? [], 0.03)).toBe(0.5);
    // Window totals: 3 hours of exalted trades, 4 of divine.
    expect(flip?.buy.units24h).toBe(3000);
    expect(flip?.units24h).toBe(3000);
  });

  it('skips cross-pair flips whose hub market did not trade that hour', () => {
    const x = [market('x', 'divine', 0.05, 1000), market('x', 'exalted', 30, 1000)];
    const file = computeFlips(
      'fr',
      [
        hour(0, x),
        // No hub ↔ hub trades: the exalted → divine conversion cannot be done this hour.
        { epoch: 3600, markets: x },
      ],
      NOW,
    );
    expect(file.flips.filter((f) => f.kind === 'cross')).toEqual([]);
    // Spreads do not convert: still listed when their own market traded.
    const withRange = computeFlips(
      'fr',
      [hour(0, []), { epoch: 3600, markets: [market('y', 'divine', 1, 1000, [1, 1.05])] }],
      NOW,
    );
    expect(withRange.flips.map((f) => f.id)).toEqual(['spread:y:divine:divine']);
  });

  it('returns no flips without data', () => {
    expect(computeFlips('fr', [], NOW).flips).toEqual([]);
  });
});
