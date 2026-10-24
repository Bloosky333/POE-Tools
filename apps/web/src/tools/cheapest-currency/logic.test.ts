import type { CurrentItem } from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import { addRecent, searchItems, toggleFavourite } from './logic.ts';

const item = (id: string, name: string, volume: number): CurrentItem => ({
  id,
  detailsId: id,
  name,
  icon: '',
  type: 'Currency',
  price: 1,
  volume,
  change7d: null,
});

describe('cheapest currency logic', () => {
  const items = [
    item('chaos', 'Chaos Orb', 9e5),
    item('alch', 'Orb of Alchemy', 10),
    item('annul', 'Orb of Annulment', 500),
  ];

  it('searches by name, most traded first, without the unit', () => {
    expect(searchItems(items, 'orb', 'chaos').map((i) => i.id)).toEqual(['annul', 'alch']);
    expect(searchItems(items, '', 'divine', 2).map((i) => i.id)).toEqual(['chaos', 'annul']);
  });

  it('keeps recent lookups unique and bounded, favourites toggled', () => {
    let saved = { recent: [], favourites: [] } as { recent: string[]; favourites: string[] };
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
      saved = addRecent(saved, id);
    expect(saved.recent).toEqual(['i', 'h', 'g', 'f', 'e', 'd', 'c', 'a']);
    saved = toggleFavourite(saved, 'x');
    expect(saved.favourites).toEqual(['x']);
    expect(toggleFavourite(saved, 'x').favourites).toEqual([]);
  });
});
