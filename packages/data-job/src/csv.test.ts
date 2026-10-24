import { describe, expect, it } from 'vitest';
import type { DailyPoint } from './convert.ts';
import {
  formatFxCsv,
  formatHistoryCsv,
  formatPairsCsv,
  mergeHistory,
  parseFxCsv,
  parseHistoryCsv,
  parsePairsCsv,
} from './csv.ts';

const point = (date: string, item: string, price: number): DailyPoint => ({
  date,
  item,
  price,
  volume: 10,
  source: 'details',
});

describe('history csv', () => {
  it('round-trips and sorts by date then item', () => {
    const points = [point('2026-09-06', 'b', 2), point('2026-09-05', 'a', 1.5)];
    const csv = formatHistoryCsv(points);
    expect(csv.split('\n')[1]).toBe('2026-09-05,a,1.5,10,details');
    expect(parseHistoryCsv(csv)).toEqual([points[1], points[0]]);
  });

  it('merges by date and item, newest wins', () => {
    const merged = mergeHistory(
      [point('2026-09-05', 'a', 1)],
      [point('2026-09-05', 'a', 2), point('2026-09-06', 'a', 3)],
    );
    expect(merged.map((p) => p.price)).toEqual([2, 3]);
  });
});

describe('fx csv', () => {
  it('round-trips missing values', () => {
    const points = [{ date: '2026-09-05', exalted: 500, chaos: null }];
    expect(parseFxCsv(formatFxCsv(points))).toEqual(points);
  });
});

describe('pairs csv', () => {
  it('round-trips and sorts by date, item, pair', () => {
    const points = [
      { date: '2026-09-05', item: 'a', pair: 'exalted' as const, rate: 97.4, volume: 1.2 },
      { date: '2026-09-05', item: 'a', pair: 'divine' as const, rate: 0.5, volume: 3 },
    ];
    const csv = formatPairsCsv(points);
    expect(csv.split('\n')[0]).toBe('date,item,pair,rate,volume_div');
    expect(parsePairsCsv(csv)).toEqual([points[1], points[0]]);
  });
});
