import { ECONOMY, type Game } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';
import { useSettings } from '../../lib/useSettings.ts';

/** Which mechanics are listed: all, or only the FARM verdicts. */
export type ShowFilter = 'all' | 'farm';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  show: ShowFilter;
  minVolume: number;
  minPrice: number;
  sort: SortKey;
  desc: boolean;
  /** Selected mechanic ('any' = the baseline row). */
  mechanic: string | null;
}

export type SortKey =
  'score' | 'mechanic' | 'value' | 'size' | 'items' | 'trend' | 'outlook' | 'confidence';

const SORT_KEYS: readonly SortKey[] = [
  'score',
  'mechanic',
  'value',
  'size',
  'items',
  'trend',
  'outlook',
  'confidence',
];

/** Defaults of a game: liquidity filters carry the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  show: 'all',
  minVolume: ECONOMY[game].minVolume,
  minPrice: ECONOMY[game].minPrice,
  sort: 'score',
  desc: true,
  mechanic: null,
});

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const [search, setSearch] = useSearchParams();
  const { game } = useSettings().settings;
  const DEFAULTS = defaultsFor(game);
  const num = (key: string, fallback: number) => {
    const value = Number(search.get(key));
    return search.has(key) && Number.isFinite(value) ? value : fallback;
  };
  const sort = search.get('sort') as SortKey | null;
  const params: ViewParams = {
    show: search.get('show') === 'farm' ? 'farm' : DEFAULTS.show,
    minVolume: num('minVolume', DEFAULTS.minVolume),
    minPrice: num('minPrice', DEFAULTS.minPrice),
    sort: sort && SORT_KEYS.includes(sort) ? sort : DEFAULTS.sort,
    desc: search.get('dir') !== 'asc',
    mechanic: search.get('mechanic'),
  };

  const update = (patch: Partial<ViewParams>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    if (next.show !== DEFAULTS.show) out.set('show', next.show);
    if (next.minVolume !== DEFAULTS.minVolume) out.set('minVolume', String(next.minVolume));
    if (next.minPrice !== DEFAULTS.minPrice) out.set('minPrice', String(next.minPrice));
    if (next.sort !== DEFAULTS.sort) out.set('sort', next.sort);
    if (!next.desc) out.set('dir', 'asc');
    if (next.mechanic) out.set('mechanic', next.mechanic);
    setSearch(out, { replace: true });
  };

  return [params, update];
}
