import { POE2_EXCHANGE_TYPES, type ExchangeType, type SellMode } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  mode: string;
  minVolume: number;
  minPrice: number;
  type: ExchangeType | 'all';
  action: 'all' | 'buy' | 'wait' | 'avoid' | 'neutral';
  q: string;
  sort: SortKey;
  desc: boolean;
  item: string | null;
}

export type SortKey =
  'score' | 'name' | 'price' | 'multiplier' | 'confidence' | 'volume' | 'change7d' | 'sellDay';

export const MODES: { value: string; label: string; mode: SellMode }[] = [
  { value: 'h7', label: 'Hold 7 days', mode: { kind: 'horizon', days: 7 } },
  { value: 'h14', label: 'Hold 14 days', mode: { kind: 'horizon', days: 14 } },
  { value: 'h30', label: 'Hold 30 days', mode: { kind: 'horizon', days: 30 } },
  { value: 'peak', label: 'Sell at peak', mode: { kind: 'peak' } },
  { value: 'end', label: 'Hold to league end', mode: { kind: 'end' } },
];

const DEFAULTS: ViewParams = {
  mode: 'h14',
  minVolume: 5,
  minPrice: 0.05,
  type: 'all',
  action: 'all',
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
  const action = search.get('action');
  const params: ViewParams = {
    mode: MODES.some((m) => m.value === search.get('mode'))
      ? (search.get('mode') ?? '')
      : DEFAULTS.mode,
    minVolume: num('minVolume', DEFAULTS.minVolume),
    minPrice: num('minPrice', DEFAULTS.minPrice),
    type: POE2_EXCHANGE_TYPES.includes(type as ExchangeType) ? (type as ExchangeType) : 'all',
    action: ['buy', 'wait', 'avoid', 'neutral'].includes(action ?? '')
      ? (action as ViewParams['action'])
      : 'all',
    q: search.get('q') ?? '',
    sort: (search.get('sort') as SortKey | null) ?? DEFAULTS.sort,
    desc: search.get('dir') !== 'asc',
    item: search.get('item'),
  };

  const update = (patch: Partial<ViewParams>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    if (next.mode !== DEFAULTS.mode) out.set('mode', next.mode);
    if (next.minVolume !== DEFAULTS.minVolume) out.set('minVolume', String(next.minVolume));
    if (next.minPrice !== DEFAULTS.minPrice) out.set('minPrice', String(next.minPrice));
    if (next.type !== 'all') out.set('type', next.type);
    if (next.action !== 'all') out.set('action', next.action);
    if (next.q) out.set('q', next.q);
    if (next.sort !== DEFAULTS.sort) out.set('sort', next.sort);
    if (!next.desc) out.set('dir', 'asc');
    if (next.item) out.set('item', next.item);
    setSearch(out, { replace: true });
  };

  return [params, update];
}
