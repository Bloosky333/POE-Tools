import { POE2_EXCHANGE_TYPES, type ExchangeType } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';
import { DEFAULTS, type SortKey, type ViewParams } from './logic.ts';

const SORT_KEYS: readonly SortKey[] = ['margin', 'name', 'recurrence', 'units', 'value'];

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const [search, setSearch] = useSearchParams();
  const num = (key: string, fallback: number) => {
    const value = Number(search.get(key));
    return search.has(key) && Number.isFinite(value) ? value : fallback;
  };
  const kind = search.get('kind');
  const type = search.get('type');
  const sort = search.get('sort');
  const params: ViewParams = {
    kind: kind === 'spread' || kind === 'cross' ? kind : 'all',
    minUnits: num('minUnits', DEFAULTS.minUnits),
    minValue: num('minValue', DEFAULTS.minValue),
    minMargin: num('minMargin', DEFAULTS.minMargin),
    minRecurrence: num('minRecurrence', DEFAULTS.minRecurrence),
    type: POE2_EXCHANGE_TYPES.includes(type as ExchangeType) ? (type as ExchangeType) : 'all',
    q: search.get('q') ?? '',
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULTS.sort,
    desc: search.get('dir') !== 'asc',
    flip: search.get('flip'),
  };

  const update = (patch: Partial<ViewParams>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    if (next.kind !== DEFAULTS.kind) out.set('kind', next.kind);
    for (const key of ['minUnits', 'minValue', 'minMargin', 'minRecurrence'] as const) {
      if (next[key] !== DEFAULTS[key]) out.set(key, String(next[key]));
    }
    if (next.type !== 'all') out.set('type', next.type);
    if (next.q) out.set('q', next.q);
    if (next.sort !== DEFAULTS.sort) out.set('sort', next.sort);
    if (!next.desc) out.set('dir', 'asc');
    if (next.flip) out.set('flip', next.flip);
    setSearch(out, { replace: true });
  };

  return [params, update];
}
