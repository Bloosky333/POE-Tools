import {
  sellSettingsFor,
  sellSignal,
  type CurrentItem,
  type HistoryPoint,
} from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import type { ViewParams } from './params.ts';
import { filterAndSort } from './SellNowPage.tsx';

const series = (price: (day: number) => number): HistoryPoint[] =>
  Array.from({ length: 61 }, (_, day) => [day, price(day), 100]);
/** Peaks on day 20, halves by day 34. */
const peak = series((day) => (day <= 20 ? 1 + day / 20 : Math.max(1, 2 - (day - 20) / 14)));
const rising = series((day) => 1 + day / 10);

const make = (id: string, price: number, volume: number, reference: HistoryPoint[]) => {
  const item: CurrentItem = {
    id,
    detailsId: id,
    name: id,
    icon: '',
    type: 'Currency',
    price,
    volume,
    change7d: null,
  };
  return sellSignal({
    item,
    reference,
    current: reference,
    today: 20,
    settings: sellSettingsFor('poe2'),
  });
};

const params: ViewParams = {
  verdict: 'flagged',
  minVolume: 5,
  minPrice: 0.05,
  type: 'all',
  q: '',
  sort: 'score',
  desc: true,
  item: null,
};

describe('filterAndSort', () => {
  const rows = [
    make('peaking', 2, 100, peak),
    make('thin', 2, 1, peak),
    make('rising', 3, 100, rising),
    make('cheap', 0.01, 100, peak),
  ];

  it('lists flagged, liquid items only by default', () => {
    expect(filterAndSort(rows, params).map((s) => s.item.id)).toEqual(['peaking']);
  });

  it('shows HOLD items on request, most urgent first', () => {
    expect(filterAndSort(rows, { ...params, verdict: 'all' }).map((s) => s.item.id)).toEqual([
      'peaking',
      'rising',
    ]);
  });

  it('searches and sorts by name', () => {
    expect(
      filterAndSort(rows, {
        ...params,
        verdict: 'all',
        minVolume: 0,
        minPrice: 0,
        sort: 'name',
        desc: false,
      }).map((s) => s.item.id),
    ).toEqual(['cheap', 'peaking', 'rising', 'thin']);
    expect(filterAndSort(rows, { ...params, q: 'PEAK' }).map((s) => s.item.id)).toEqual([
      'peaking',
    ]);
  });
});
