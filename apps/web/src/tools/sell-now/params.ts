import { POE2_EXCHANGE_TYPES, type ExchangeType } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';

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

const DEFAULTS: ViewParams = {
  verdict: 'flagged',
  minVolume: 5,
  minPrice: 0.05,
  type: 'all',
  q: '',
  sort: 'score',
  desc: true,
  item: null,
};

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const [search, setSearch] = useSearchParams();
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
    type: POE2_EXCHANGE_TYPES.includes(type as ExchangeType) ? (type as ExchangeType) : 'all',
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
