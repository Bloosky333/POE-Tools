import { describe, expect, it } from 'vitest';
import type { PairQuote } from '../site-data.ts';
import { cheapest, cheapestSettingsFor } from './engine.ts';

const quote = (rate: number, volume: number | null = 50): PairQuote => ({
  rate,
  volume,
  asOf: '2026-10-24T00:00:00.000Z',
  source: 'daily',
});

describe('cheapest (PoE 2, divine unit)', () => {
  const base = {
    unit: 'divine' as const,
    rates: { exalted: 700, chaos: 10 },
    currencies: ['divine', 'exalted', 'chaos'] as const,
    settings: cheapestSettingsFor('poe2'),
  };

  it('pays whole units and recommends a clearly cheaper pair', () => {
    // 0.3 div, 140 ex (0.2 div), 3 chaos (0.3 div) per item.
    const result = cheapest({
      ...base,
      quantity: 2,
      quotes: { divine: quote(0.3), exalted: quote(140), chaos: quote(3) },
    });
    expect(result.options.map((o) => o.currency)).toEqual(['exalted', 'chaos', 'divine']);
    const divine = result.options.find((o) => o.currency === 'divine');
    // 0.6 div rounds up to 1 whole divine, which buys 3 items.
    expect(divine).toMatchObject({ pay: 1, cost: 1, cleanQuantity: 3 });
    expect(divine?.waste).toBeCloseTo(0.4);
    expect(result.verdict).toMatchObject({ currency: 'exalted' });
    expect(result.verdict?.savingVsNext).toBeCloseTo(1 - 0.4 / 0.6);
  });

  it('gives no verdict for a small difference, thin or unknown volume, or one pair', () => {
    const close = cheapest({
      ...base,
      // 7,000 ex = 10 div vs 102 chaos = 10.2 div: 2 % apart.
      quantity: 100,
      quotes: { exalted: quote(70), chaos: quote(1.02) },
    });
    expect(close).toMatchObject({ verdict: null, reason: 'small-difference' });
    const thin = cheapest({
      ...base,
      quantity: 1,
      quotes: { exalted: quote(70, 0.5), chaos: quote(2) },
    });
    expect(thin.reason).toBe('low-volume');
    const unknown = cheapest({
      ...base,
      quantity: 1,
      quotes: { exalted: quote(70, null), chaos: quote(2) },
    });
    expect(unknown.reason).toBe('unknown-volume');
    expect(cheapest({ ...base, quantity: 1, quotes: { chaos: quote(2) } }).reason).toBe(
      'single-pair',
    );
  });
});

describe('cheapest (PoE 1, chaos unit)', () => {
  it('costs a divine at its chaos rate and shows the waste of paying in divines', () => {
    // Golden Oil, 2026-10-24: 287.5 c or 0.7692 div (≈ 252 c at 328 c/div).
    const result = cheapest({
      unit: 'chaos',
      rates: { divine: 1 / 328 },
      currencies: ['chaos', 'divine'],
      settings: cheapestSettingsFor('poe1'),
      quantity: 1,
      quotes: { chaos: quote(287.5, 2588), divine: quote(0.7692, 2020) },
    });
    const divine = result.options.find((o) => o.currency === 'divine');
    // One whole divine (328 c) for 1 oil: more than 288 c.
    expect(divine).toMatchObject({ pay: 1, cost: 328, cleanQuantity: 1 });
    expect(result.options[0]?.currency).toBe('chaos');
    expect(result.verdict?.currency).toBe('chaos');
    const thirteen = cheapest({
      unit: 'chaos',
      rates: { divine: 1 / 328 },
      currencies: ['chaos', 'divine'],
      settings: cheapestSettingsFor('poe1'),
      quantity: 13,
      quotes: { chaos: quote(287.5, 2588), divine: quote(0.7692, 2020) },
    });
    // 13 oils: exactly 10 divines (3,280 c) vs 3,738 c in chaos.
    expect(thirteen.options[0]).toMatchObject({ currency: 'divine', pay: 10 });
    expect(thirteen.verdict?.currency).toBe('divine');
  });
});
