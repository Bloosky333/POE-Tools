import { ECONOMY, isExchangeType, type ExchangeType, type Game } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';
import { useSettings } from '../../lib/useSettings.ts';

/** Which verdicts are listed: flagged = SELL NOW + SELL SOON. */
export type VerdictFilter = 'flagged' | 'sell-now' | 'sell-soon' | 'all';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  verdict: VerdictFilter;
  minVolume: number;
  minPrice: number;
  type: ExchangeType | 'all';
  q: string;
  sort: SortKey;
  desc: boolean;
  item: string | null;
}

export type SortKey =
  | 'score'
  | 'name'
  | 'price'
  | 'change1d'
  | 'change3d'
  | 'change7d'
  | 'fromHigh'
  | 'loss'
  | 'sellDay'
  | 'confidence'
  | 'volume';

const VERDICTS: readonly VerdictFilter[] = ['flagged', 'sell-now', 'sell-soon', 'all'];

/** Defaults of a game: liquidity filters carry the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  verdict: 'flagged',
  minVolume: ECONOMY[game].minVolume,
  minPrice: ECONOMY[game].minPrice,
  type: 'all',
  q: '',
  sort: 'score',
  desc: true,
  item: null,
});

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const [search, setSearch] = useSearchParams();
  const { game } = useSettings().settings;
  const DEFAULTS = defaultsFor(game);
  const num = (key: string, fallback: number) => {
    const value = Number(search.get(key));
    return search.has(key) && Number.isFinite(value) ? value : fallback;
  };
  const type = search.get('type');
  const verdict = search.get('verdict');
  const params: ViewParams = {
    verdict: VERDICTS.includes(verdict as VerdictFilter)
      ? (verdict as VerdictFilter)
      : DEFAULTS.verdict,
    minVolume: num('minVolume', DEFAULTS.minVolume),
    minPrice: num('minPrice', DEFAULTS.minPrice),
    type: type && isExchangeType(game, type) ? type : 'all',
    q: search.get('q') ?? '',
    sort: (search.get('sort') as SortKey | null) ?? DEFAULTS.sort,
    desc: search.get('dir') !== 'asc',
    item: search.get('item'),
  };

  const update = (patch: Partial<ViewParams>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    if (next.verdict !== DEFAULTS.verdict) out.set('verdict', next.verdict);
    if (next.minVolume !== DEFAULTS.minVolume) out.set('minVolume', String(next.minVolume));
    if (next.minPrice !== DEFAULTS.minPrice) out.set('minPrice', String(next.minPrice));
    if (next.type !== 'all') out.set('type', next.type);
    if (next.q) out.set('q', next.q);
    if (next.sort !== DEFAULTS.sort) out.set('sort', next.sort);
    if (!next.desc) out.set('dir', 'asc');
    if (next.item) out.set('item', next.item);
    setSearch(out, { replace: true });
  };

  return [params, update];
}
