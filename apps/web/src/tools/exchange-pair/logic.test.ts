// @vitest-environment jsdom
import type { CurrentItem } from '@poe-tools/shared';
import { describe, expect, it } from 'vitest';
import { addRecent, loadSaved, searchItems, storeSaved, toggleFavourite } from './logic.ts';

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

describe('exchange pair logic', () => {
  const items = [
    item('chaos', 'Chaos Orb', 9e5),
    item('alch', 'Orb of Alchemy', 10),
    item('annul', 'Orb of Annulment', 500),
  ];

  it('searches by name, most traded first, without the unit', () => {
    expect(searchItems(items, 'orb', 'chaos').map((i) => i.id)).toEqual(['annul', 'alch']);
    expect(searchItems(items, '', 'divine', 'all', 2).map((i) => i.id)).toEqual(['chaos', 'annul']);
  });

  it('filters by category', () => {
    const rune = { ...item('rune', 'Iron Rune', 50), type: 'Runes' as const };
    expect(searchItems([...items, rune], '', 'divine', 'Runes').map((i) => i.id)).toEqual(['rune']);
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

  it('keeps lists per tool and reads Buy With from the old Cheapest Currency key', () => {
    localStorage.clear();
    localStorage.setItem('poe-tools:cheapest-currency:poe2', '{"recent":["x"],"favourites":[]}');
    expect(loadSaved('buy-with', 'poe2').recent).toEqual(['x']);
    expect(loadSaved('sell-for', 'poe2').recent).toEqual([]);
    storeSaved('buy-with', 'poe2', { recent: ['y'], favourites: [] });
    expect(localStorage.getItem('poe-tools:cheapest-currency:poe2')).toBeNull();
    expect(loadSaved('buy-with', 'poe2').recent).toEqual(['y']);
  });
});
