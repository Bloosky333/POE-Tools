import { isExchangeType, type ExchangeType, type Game } from '@poe-tools/shared';
import { useSearchParams } from 'react-router';

/*
 * View state kept in the URL (filters, sort, selection) so views can be bookmarked and
 * shared. Only values that differ from the defaults are written.
 */

/** How one parameter is read from and written to the URL. */
export interface UrlField<T> {
  /** URL key, when it differs from the parameter name. */
  key?: string;
  /** Value of a raw URL string; undefined (invalid) falls back to the default. */
  parse(raw: string): T | undefined;
  format(value: T): string;
}

export const urlField = {
  number: (): UrlField<number> => ({
    parse: (raw) => (raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined),
    format: String,
  }),
  oneOf: <T extends string>(values: readonly T[]): UrlField<T> => ({
    parse: (raw) => values.find((value) => value === raw),
    format: (value) => value,
  }),
  text: (): UrlField<string> => ({ parse: (raw) => raw, format: (value) => value }),
  /** A selected id (detail sheet), absent when nothing is selected. */
  selection: (): UrlField<string | null> => ({
    parse: (raw) => raw || undefined,
    format: (value) => value ?? '',
  }),
  /** Sort direction as `dir=asc`; descending (the default) is not written. */
  descending: (): UrlField<boolean> => ({
    key: 'dir',
    parse: (raw) => (raw === 'asc' ? false : undefined),
    format: (value) => (value ? 'desc' : 'asc'),
  }),
};

/** Exchange category of `game`, or 'all'. */
export function exchangeTypeField(game: Game): UrlField<ExchangeType | 'all'> {
  return {
    parse: (raw) => (isExchangeType(game, raw) ? raw : undefined),
    format: (value) => value,
  };
}

export type UrlFields<P> = { [K in keyof P]: UrlField<P[K]> };

/** Parameters `P` from the URL (falling back to `defaults`) and a setter for a patch. */
export function useUrlParams<P extends object>(
  defaults: P,
  fields: UrlFields<P>,
): [P, (patch: Partial<P>) => void] {
  const [search, setSearch] = useSearchParams();
  const keys = Object.keys(fields) as (keyof P & string)[];
  const params = { ...defaults };
  for (const name of keys) {
    const field = fields[name];
    const raw = search.get(field.key ?? name);
    const value = raw === null ? undefined : field.parse(raw);
    if (value !== undefined) params[name] = value;
  }

  const update = (patch: Partial<P>) => {
    const next = { ...params, ...patch };
    const out = new URLSearchParams();
    for (const name of keys) {
      const value = next[name];
      if (value === defaults[name] || value === null || value === '') continue;
      out.set(fields[name].key ?? name, fields[name].format(value));
    }
    setSearch(out, { replace: true });
  };

  return [params, update];
}
