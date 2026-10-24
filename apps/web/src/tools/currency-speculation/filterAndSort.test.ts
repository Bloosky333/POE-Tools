import { suggest, type CurrentItem, type HistoryPoint } from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import { filterAndSort } from './CurrencySpeculationPage.tsx';
import type { ViewParams } from './params.ts';

const rising: HistoryPoint[] = Array.from({ length: 60 }, (_, day) => [day, 1 + day / 10, 100]);

const make = (id: string, price: number, volume: number) => {
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
  return suggest({
    item,
    reference: rising,
    current: rising,
    today: 10,
    mode: { kind: 'horizon', days: 7 },
  });
};

const params: ViewParams = {
  mode: 'h7',
  minVolume: 5,
  minPrice: 0.05,
  type: 'all',
  action: 'all',
  q: '',
  sort: 'price',
  desc: true,
  item: null,
};

describe('filterAndSort', () => {
  const rows = [
    make('cheap', 0.01, 100),
    make('thin', 3, 1),
    make('alpha', 1, 50),
    make('beta', 2, 50),
  ];

  it('applies volume and price filters, then sorts', () => {
    expect(filterAndSort(rows, params).map((s) => s.item.id)).toEqual(['beta', 'alpha']);
  });

  it('searches by name and sorts ascending', () => {
    expect(filterAndSort(rows, { ...params, q: 'ALP' }).map((s) => s.item.id)).toEqual(['alpha']);
    expect(
      filterAndSort(rows, { ...params, sort: 'name', desc: false, minVolume: 0, minPrice: 0 }).map(
        (s) => s.item.id,
      ),
    ).toEqual(['alpha', 'beta', 'cheap', 'thin']);
  });
});
