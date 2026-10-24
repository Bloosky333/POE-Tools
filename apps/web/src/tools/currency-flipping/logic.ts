import {
  ECONOMY,
  recurrence,
  type CurrentItem,
  type ExchangeType,
  type Flip,
  type Game,
} from '@poe-tools/shared';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  kind: 'all' | Flip['kind'];
  /** Min units of the item traded over the window, on every leg. */
  minUnits: number;
  /** Min value (game unit) traded over the window, on every leg. */
  minValue: number;
  /** In %, e.g. 3 = 3 %. Also the threshold of the recurrence count. */
  minMargin: number;
  /** In %, share of the window's hours with at least `minMargin`. */
  minRecurrence: number;
  type: ExchangeType | 'all';
  q: string;
  sort: SortKey;
  desc: boolean;
  flip: string | null;
}

export type SortKey = 'margin' | 'name' | 'recurrence' | 'units' | 'value';

/** Defaults of a game: the value filter carries the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  kind: 'all',
  minUnits: 50,
  minValue: ECONOMY[game].flipDefaultValue,
  minMargin: 3,
  minRecurrence: 25,
  type: 'all',
  q: '',
  sort: 'margin',
  desc: true,
  flip: null,
});

export const DEFAULTS: ViewParams = defaultsFor('poe2');

export interface FlipRow {
  flip: Flip;
  item: CurrentItem | undefined;
  /** 0–100. */
  recurrence: number;
}

export function toRows(
  flips: readonly Flip[],
  items: ReadonlyMap<string, CurrentItem>,
  minMargin: number,
): FlipRow[] {
  return flips.map((flip) => ({
    flip,
    item: items.get(flip.item),
    recurrence: Math.round(recurrence(flip.hourly, minMargin / 100) * 100),
  }));
}

export function filterAndSort(rows: readonly FlipRow[], params: ViewParams): FlipRow[] {
  const q = params.q.trim().toLowerCase();
  const out = rows.filter(
    ({ flip, item, recurrence }) =>
      (params.kind === 'all' || flip.kind === params.kind) &&
      flip.units24h >= params.minUnits &&
      flip.value24h >= params.minValue &&
      flip.margin * 100 >= params.minMargin &&
      recurrence >= params.minRecurrence &&
      (params.type === 'all' || item?.type === params.type) &&
      (!q || (item?.name ?? flip.item).toLowerCase().includes(q)),
  );
  const value = ({ flip, item, recurrence }: FlipRow): number | string => {
    switch (params.sort) {
      case 'name':
        return item?.name ?? flip.item;
      case 'recurrence':
        return recurrence;
      case 'units':
        return flip.units24h;
      case 'value':
        return flip.value24h;
      default:
        return flip.margin;
    }
  };
  return out.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number);
    return params.desc ? -cmp : cmp;
  });
}

/**
 * Integer ratio `[hub, items]` closest to `price` (hub units per 1 item), as typed in the
 * in-game exchange: the best rational approximation with both terms ≤ `max`.
 */
export function toRatio(price: number, max = 1000): [number, number] {
  if (!(price > 0) || !Number.isFinite(price)) return [0, 1];
  // Continued fraction convergents of `price`, kept while both terms fit.
  let [h0, h1] = [0, 1];
  let [k0, k1] = [1, 0];
  let x = price;
  let best: [number, number] =
    price >= 1 ? [Math.min(Math.round(price), max), 1] : [1, Math.min(Math.round(1 / price), max)];
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x);
    const h = a * h1 + h0;
    const k = a * k1 + k0;
    if (h > max || k > max) break;
    if (h > 0) best = [h, k];
    if (Math.abs(h / k - price) <= price * 1e-4) break;
    [h0, h1, k0, k1] = [h1, h, k1, k];
    const frac = x - a;
    if (frac < 1e-9) break;
    x = 1 / frac;
  }
  return best;
}
