import { describe, expect, it } from 'vitest';
import type { PairQuote } from '../site-data.ts';
import { bestPair, bestPairSettingsFor } from './engine.ts';

const quote = (rate: number, volume: number | null = 50): PairQuote => ({
  rate,
  volume,
  asOf: '2026-10-24T00:00:00.000Z',
  source: 'daily',
});

describe('bestPair, buying (PoE 2, divine unit)', () => {
  const base = {
    side: 'buy' as const,
    unit: 'divine' as const,
    rates: { exalted: 700, chaos: 10 },
    currencies: ['divine', 'exalted', 'chaos'] as const,
    settings: bestPairSettingsFor('poe2'),
  };

  it('pays whole units and recommends a clearly cheaper pair', () => {
    // 0.3 div, 140 ex (0.2 div), 3 chaos (0.3 div) per item.
    const result = bestPair({
      ...base,
      quantity: 2,
      quotes: { divine: quote(0.3), exalted: quote(140), chaos: quote(3) },
    });
    expect(result.options.map((o) => o.currency)).toEqual(['exalted', 'chaos', 'divine']);
    const divine = result.options.find((o) => o.currency === 'divine');
    // 0.6 div rounds up to 1 whole divine, which buys 3 items.
    expect(divine).toMatchObject({ amount: 1, value: 1, cleanQuantity: 3 });
    expect(divine?.rounding).toBeCloseTo(0.4);
    expect(result.verdict).toMatchObject({ currency: 'exalted' });
    expect(result.verdict?.edgeVsNext).toBeCloseTo(1 - 0.4 / 0.6);
  });

  it('gives no verdict for a small difference, thin or unknown volume, or one pair', () => {
    const close = bestPair({
      ...base,
      // 7,000 ex = 10 div vs 102 chaos = 10.2 div: 2 % apart.
      quantity: 100,
      quotes: { exalted: quote(70), chaos: quote(1.02) },
    });
    expect(close).toMatchObject({ verdict: null, reason: 'small-difference' });
    const thin = bestPair({
      ...base,
      quantity: 1,
      quotes: { exalted: quote(70, 0.5), chaos: quote(2) },
    });
    expect(thin.reason).toBe('low-volume');
    const unknown = bestPair({
      ...base,
      quantity: 1,
      quotes: { exalted: quote(70, null), chaos: quote(2) },
    });
    expect(unknown.reason).toBe('unknown-volume');
    expect(bestPair({ ...base, quantity: 1, quotes: { chaos: quote(2) } }).reason).toBe(
      'single-pair',
    );
  });
});

describe('bestPair, buying (PoE 1, chaos unit)', () => {
  it('costs a divine at its chaos rate and shows the waste of paying in divines', () => {
    // Golden Oil, 2026-10-24: 287.5 c or 0.7692 div (≈ 252 c at 328 c/div).
    const input = {
      side: 'buy' as const,
      unit: 'chaos' as const,
      rates: { divine: 1 / 328 },
      currencies: ['chaos', 'divine'] as const,
      settings: bestPairSettingsFor('poe1'),
      quotes: { chaos: quote(287.5, 2588), divine: quote(0.7692, 2020) },
    };
    const result = bestPair({ ...input, quantity: 1 });
    const divine = result.options.find((o) => o.currency === 'divine');
    // One whole divine (328 c) for 1 oil: more than 288 c.
    expect(divine).toMatchObject({ amount: 1, value: 328, cleanQuantity: 1 });
    expect(result.options[0]?.currency).toBe('chaos');
    expect(result.verdict?.currency).toBe('chaos');
    const thirteen = bestPair({ ...input, quantity: 13 });
    // 13 oils: exactly 10 divines (3,280 c) vs 3,738 c in chaos.
    expect(thirteen.options[0]).toMatchObject({ currency: 'divine', amount: 10 });
    expect(thirteen.verdict?.currency).toBe('divine');
  });
});

describe('bestPair, selling', () => {
  const poe2 = {
    side: 'sell' as const,
    unit: 'divine' as const,
    rates: { exalted: 700, chaos: 10 },
    currencies: ['divine', 'exalted', 'chaos'] as const,
    settings: bestPairSettingsFor('poe2'),
  };

  it('receives whole units rounded down and recommends the best-paying pair', () => {
    // 0.3 div, 280 ex (0.4 div), 3 chaos (0.3 div) per item.
    const result = bestPair({
      ...poe2,
      quantity: 5,
      quotes: { divine: quote(0.3), exalted: quote(280), chaos: quote(3) },
    });
    expect(result.options.map((o) => o.currency)).toEqual(['exalted', 'chaos', 'divine']);
    const divine = result.options.find((o) => o.currency === 'divine');
    // 1.5 div rounds down to 1 whole divine, which only takes 4 items.
    expect(divine).toMatchObject({ amount: 1, value: 1, cleanQuantity: 4 });
    expect(divine?.rounding).toBeCloseTo(0.5);
    expect(result.options[0]).toMatchObject({ amount: 1400, value: 2, cleanQuantity: 5 });
    // Chaos pays 1.5 div: 25 % less than exalted (2 div); divine 50 % less.
    expect(result.verdict).toMatchObject({ currency: 'exalted' });
    expect(result.verdict?.edgeVsNext).toBeCloseTo(0.25);
    expect(result.verdict?.edgeVsWorst).toBeCloseTo(0.5);
  });

  it('flags a quantity worth less than one unit of every currency', () => {
    const result = bestPair({
      ...poe2,
      quantity: 2,
      quotes: { divine: quote(0.3), chaos: quote(0.4) },
    });
    expect(result).toMatchObject({ verdict: null, reason: 'too-few' });
    // One whole divine takes 4 items, one chaos 3.
    expect(result.options.map((o) => [o.currency, o.amount, o.cleanQuantity])).toEqual([
      ['divine', 0, 4],
      ['chaos', 0, 3],
    ]);
  });

  it('prefers chaos when a PoE 1 item is worth less than a divine', () => {
    // Golden Oil: 1 oil sells for 287 c, or 0 divines (0.77 rounds down).
    const result = bestPair({
      side: 'sell',
      unit: 'chaos',
      rates: { divine: 1 / 328 },
      currencies: ['chaos', 'divine'],
      settings: bestPairSettingsFor('poe1'),
      quantity: 1,
      quotes: { chaos: quote(287.5, 2588), divine: quote(0.7692, 2020) },
    });
    expect(result.options[0]).toMatchObject({ currency: 'chaos', amount: 287 });
    expect(result.verdict).toMatchObject({ currency: 'chaos', edgeVsNext: 1 });
  });
});
