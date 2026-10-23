import { describe, expect, it } from 'vitest';
import {
  detailsToDailyPoints,
  fxFromDivineDetails,
  fxFromOverview,
  overviewToItems,
} from './convert.ts';
import { exchangeDetailsSchema, exchangeOverviewSchema } from './poe-ninja/schemas.ts';
import { probeJson } from './test/fixtures.ts';

const overview = exchangeOverviewSchema.parse(
  probeJson('exchange-overview-currency-runes-of-aldur.json'),
);
const divine = exchangeDetailsSchema.parse(
  probeJson('exchange-details-divine-orb-runes-of-aldur.json'),
);
const chaos = exchangeDetailsSchema.parse(
  probeJson('exchange-details-chaos-orb-runes-of-aldur.json'),
);
const TODAY = '2026-10-23';

describe('overviewToItems', () => {
  it('maps lines to items priced in divine', () => {
    const items = overviewToItems(overview, 'Currency');
    expect(items).toHaveLength(overview.lines.length);
    const chaosItem = items.find((item) => item.id === 'chaos');
    expect(chaosItem).toMatchObject({
      detailsId: 'chaos-orb',
      name: 'Chaos Orb',
      type: 'Currency',
      price: 0.111,
    });
    expect(chaosItem?.icon).toMatch(/^https:\/\/poe\.ninja\/gen\/image\//);
    expect(items.find((item) => item.id === 'divine')?.price).toBe(1);
  });

  it('reads exchange rates per divine', () => {
    expect(fxFromOverview(overview, TODAY)).toEqual({
      date: TODAY,
      exalted: 546.1,
      chaos: 9.01,
    });
  });
});

describe('details conversion', () => {
  const fx = fxFromDivineDetails(divine, TODAY);
  const fxByDate = new Map(fx.map((p) => [p.date, p]));

  it('extracts daily rates for completed days only', () => {
    expect(fx[0]?.date).toBe('2026-05-29');
    expect(fx.at(-1)?.date).toBe('2026-10-22');
    expect(fx.every((p) => p.exalted && p.chaos)).toBe(true);
  });

  it('converts the Chaos Orb history to a divine price close to the overview', () => {
    const points = detailsToDailyPoints(chaos, 'chaos', fxByDate, TODAY);
    expect(points).toHaveLength(147);
    expect(points[0]?.date).toBe('2026-05-29');
    const last = points.at(-1);
    expect(last?.date).toBe('2026-10-22');
    // Overview today: 0.111 div per chaos; yesterday's close should be near it.
    expect(last?.price).toBeGreaterThan(0.09);
    expect(last?.price).toBeLessThan(0.13);
    expect(last?.volume).toBeGreaterThan(0);
  });

  it('ignores pairs it cannot convert', () => {
    const points = detailsToDailyPoints(chaos, 'chaos', new Map(), TODAY);
    // Without fx only the divine pair is usable, which still gives a price per day.
    expect(points.every((p) => p.price > 0)).toBe(true);
  });
});
