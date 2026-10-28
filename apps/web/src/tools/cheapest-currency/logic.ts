import type { CurrentItem, Game } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';

/** Lookup state, kept in the URL so a lookup can be shared. */
export interface ViewParams {
  item: string | null;
  quantity: number;
  q: string;
}

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const [search, setSearch] = useSearchParams();
  const quantity = Math.floor(Number(search.get('qty')));
  const params: ViewParams = {
    item: search.get('item'),
    quantity: Number.isFinite(quantity) && quantity >= 1 ? quantity : 1,
    q: search.get('q') ?? '',
  };
  const update = (patch: Partial<ViewParams>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    if (next.item) out.set('item', next.item);
    if (next.quantity !== 1) out.set('qty', String(next.quantity));
    if (next.q) out.set('q', next.q);
    setSearch(out, { replace: true });
  };
  return [params, update];
}

/** Items matching a search, most traded first. */
export function searchItems(
  items: readonly CurrentItem[],
  q: string,
  exclude: string,
  limit = 12,
): CurrentItem[] {
  const query = q.trim().toLowerCase();
  return items
    .filter((item) => item.id !== exclude && (!query || item.name.toLowerCase().includes(query)))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}

/** Recent lookups and favourites of a game, newest first (localStorage). */
export interface Saved {
  recent: string[];
  favourites: string[];
}

const MAX_RECENT = 8;
const key = (game: Game) => `poe-tools:cheapest-currency:${game}`;

export function loadSaved(game: Game): Saved {
  try {
    const raw = localStorage.getItem(key(game));
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown> | null) : null;
    return { recent: ids(parsed?.recent), favourites: ids(parsed?.favourites) };
  } catch {
    return { recent: [], favourites: [] };
  }
}

/** Item ids of a stored list; anything else (hand-edited or corrupt storage) is dropped. */
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function storeSaved(game: Game, saved: Saved): void {
  try {
    localStorage.setItem(key(game), JSON.stringify(saved));
  } catch {
    // Storage unavailable: lookups just aren't remembered.
  }
}

export function addRecent(saved: Saved, item: string): Saved {
  return {
    ...saved,
    recent: [item, ...saved.recent.filter((i) => i !== item)].slice(0, MAX_RECENT),
  };
}

export function toggleFavourite(saved: Saved, item: string): Saved {
  return {
    ...saved,
    favourites: saved.favourites.includes(item)
      ? saved.favourites.filter((i) => i !== item)
      : [item, ...saved.favourites],
  };
}
