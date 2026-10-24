import {
  farmSignals,
  type CurrentItem,
  type ExchangeType,
  type HistoryPoint,
} from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import type { ViewParams } from './params.ts';
import { filterAndSort } from './WhatToFarmPage.tsx';

const series = (price: (day: number) => number, last = 60): HistoryPoint[] =>
  Array.from({ length: last + 1 }, (_, day) => [day, price(day), 100]);

const item = (id: string, type: ExchangeType): CurrentItem => ({
  id,
  detailsId: id,
  name: id,
  icon: '',
  type,
  price: 1,
  volume: 100,
  change7d: null,
});

/** 12 flat general items, Breach rising last league, Delirium falling, Ritual flat. */
function signals() {
  const items: CurrentItem[] = [];
  const currentHistory: Record<string, HistoryPoint[]> = {};
  const referenceHistory: Record<string, HistoryPoint[]> = {};
  const add = (id: string, type: ExchangeType, ref: (day: number) => number) => {
    items.push(item(id, type));
    currentHistory[id] = series(() => 1, 19);
    referenceHistory[id] = series(ref);
  };
  for (let i = 0; i < 12; i++) add(`gem-${i}`, 'UncutGems', () => 1);
  add('cat', 'Breach', (d) => (d <= 20 ? 1 : 1 + (d - 20) / 14));
  add('emotion', 'Delirium', (d) => (d <= 20 ? 1 : 0.5));
  add('omen', 'Ritual', () => 1);
  return farmSignals({ game: 'poe2', items, currentHistory, referenceHistory, today: 20 });
}

const params: ViewParams = {
  show: 'all',
  minVolume: 5,
  minPrice: 0.05,
  sort: 'score',
  desc: true,
  mechanic: null,
};

describe('filterAndSort', () => {
  it('ranks FARM & HOLD, FARM & SELL, the baseline, then AVOID', () => {
    expect(filterAndSort(signals(), params).map((s) => s.mechanic)).toEqual([
      'Breach',
      'Ritual',
      null,
      'Delirium',
    ]);
  });

  it('keeps the baseline when showing only FARM verdicts', () => {
    expect(filterAndSort(signals(), { ...params, show: 'farm' }).map((s) => s.mechanic)).toEqual([
      'Breach',
      'Ritual',
      null,
    ]);
  });

  it('sorts by a column', () => {
    const rows = filterAndSort(signals(), { ...params, sort: 'outlook', desc: false });
    expect(rows[0]?.mechanic).toBe('Delirium');
  });
});
