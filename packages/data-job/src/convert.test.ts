import { describe, expect, it } from 'vitest';
import {
  detailsToDailyPoints,
  fxFromOverview,
  fxFromUnitDetails,
  overviewToItems,
} from './convert.ts';
import { exchangeDetailsSchema, exchangeOverviewSchema } from './poe-ninja/schemas.ts';
import { poe1Json, probeJson } from './test/fixtures.ts';

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
    expect(chaosItem?.icon).toMatch(/^\/gen\/image\/.+\.png$/);
    expect(items.find((item) => item.id === 'divine')?.price).toBe(1);
  });

  it('drops ids that would break the history CSV', () => {
    const [line] = overview.lines;
    const [meta] = overview.items;
    if (!line || !meta) throw new Error('missing fixture data');
    const odd = {
      ...overview,
      lines: [{ ...line, id: 'a,b' }],
      items: [{ ...meta, id: 'a,b' }],
    };
    expect(overviewToItems(odd, 'Currency')).toEqual([]);
  });

  it('reads exchange rates per divine', () => {
    expect(fxFromOverview(overview, TODAY, ['exalted', 'chaos'])).toEqual({
      date: TODAY,
      rates: { exalted: 546.1, chaos: 9.01 },
    });
  });
});

describe('details conversion', () => {
  const fx = fxFromUnitDetails(divine, TODAY, ['exalted', 'chaos']);
  const fxByDate = new Map(fx.map((p) => [p.date, p]));

  it('extracts daily rates for completed days only', () => {
    expect(fx[0]?.date).toBe('2026-05-29');
    expect(fx.at(-1)?.date).toBe('2026-10-22');
    expect(fx.every((p) => p.rates.exalted && p.rates.chaos)).toBe(true);
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

  it('averages pairs by traded items, staying within the pair prices', () => {
    // Forbidden Rites 2026-10-22 rates (fx.csv of the data branch), applied to every day.
    const rates = { exalted: 696.6, chaos: 9.77 };
    for (const fixture of ['uncut-skill-gem-level-19', 'siones-temper', 'artificers-orb']) {
      const details = exchangeDetailsSchema.parse(
        probeJson(`exchange-details-${fixture}-forbidden-rites.json`),
      );
      const dates = details.pairs.flatMap((p) => p.history.map((h) => h.timestamp.slice(0, 10)));
      const fxMap = new Map(dates.map((date) => [date, { date, rates }]));
      const point = detailsToDailyPoints(details, fixture, fxMap, TODAY).find(
        (p) => p.date === '2026-10-22',
      );
      const pairPrices = details.pairs.flatMap((pair) => {
        const h = pair.history.find((x) => x.timestamp.startsWith('2026-10-22'));
        const per = pair.id === 'divine' ? 1 : 1 / rates[pair.id as 'exalted' | 'chaos'];
        return h?.rate ? [h.rate * per] : [];
      });
      expect(point?.price).toBeGreaterThanOrEqual(Math.min(...pairPrices) * 0.999);
      expect(point?.price).toBeLessThanOrEqual(Math.max(...pairPrices) * 1.001);
      const totalVolume = details.pairs.reduce(
        (sum, pair) =>
          sum +
          (pair.history.find((x) => x.timestamp.startsWith('2026-10-22'))?.volumePrimaryValue ?? 0),
        0,
      );
      expect(point?.volume).toBeCloseTo(totalVolume, 2);
    }
  });

  it('skips points without a rate', () => {
    const details = exchangeDetailsSchema.parse(
      probeJson('exchange-details-adept-rune-forbidden-rites.json'),
    );
    const points = detailsToDailyPoints(details, 'adept-rune', fxByDate, TODAY);
    expect(points.every((p) => Number.isFinite(p.price) && p.price > 0)).toBe(true);
  });

  it('ignores pairs it cannot convert', () => {
    const points = detailsToDailyPoints(chaos, 'chaos', new Map(), TODAY);
    // Without fx only the divine pair is usable, which still gives a price per day.
    expect(points.every((p) => p.price > 0)).toBe(true);
  });
});

describe('PoE 1 (chaos unit)', () => {
  const POE1_TODAY = '2026-10-24';
  const chaosDetails = exchangeDetailsSchema.parse(poe1Json('details-chaos-orb-allflame.json'));
  const fx = fxFromUnitDetails(chaosDetails, POE1_TODAY, ['divine']);
  const fxByDate = new Map(fx.map((p) => [p.date, p]));

  it('reads divine per chaos from the Chaos Orb details', () => {
    expect(fx[0]?.date).toBe('2026-07-25');
    expect(fx.at(-1)?.date).toBe('2026-10-23');
    // ~330 chaos per divine late in the league.
    expect(1 / (fx.at(-1)?.rates.divine ?? 1)).toBeGreaterThan(200);
  });

  it('prices items in chaos over the chaos and divine pairs', () => {
    const oil = exchangeDetailsSchema.parse(poe1Json('details-golden-oil-allflame.json'));
    const last = detailsToDailyPoints(oil, 'golden-oil', fxByDate, POE1_TODAY, 'chaos').at(-1);
    expect(last?.date).toBe('2026-10-23');
    // Overview on the 24th: 287.5 c.
    expect(last?.price).toBeGreaterThan(200);
    expect(last?.price).toBeLessThan(400);
  });

  it('prices the Divine Orb itself in chaos', () => {
    const divineOrb = exchangeDetailsSchema.parse(poe1Json('details-divine-orb-allflame.json'));
    const last = detailsToDailyPoints(divineOrb, 'divine', fxByDate, POE1_TODAY, 'chaos').at(-1);
    expect(last?.price).toBeCloseTo(1 / (fx.at(-1)?.rates.divine ?? 1), -1);
  });
});
