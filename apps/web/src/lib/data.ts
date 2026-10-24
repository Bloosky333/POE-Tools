import craftingBasesUrl from '@poe-tools/shared/data/crafting-bases-poe2.json?url';
import craftingModsUrl from '@poe-tools/shared/data/crafting-mods-poe2.json?url';
import {
  EXCHANGE_TYPES,
  craftingBasesFileSchema,
  craftingModsFileSchema,
  currentFileSchema,
  dataPaths,
  flipsFileSchema,
  pairsFileSchema,
  historyFileSchema,
  type CraftingBasesFile,
  type CraftingModsFile,
  type CurrentFile,
  type FlipsFile,
  type PairsFile,
  type Game,
  type HistoryPoint,
} from '@poe-tools/shared';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

/*
 * Site data published by the data job under `<base>/data/`. Each file is fetched once per
 * page load and validated; responses are cached by path.
 */

const cache = new Map<string, Promise<unknown>>();

export class DataNotFoundError extends Error {}

export function fetchData<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let promise = cache.get(path) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}data/${path}`).then(async (res) => {
      if (res.status === 404) throw new DataNotFoundError(path);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return schema.parse(await res.json());
    });
    promise.catch(() => cache.delete(path));
    cache.set(path, promise);
  }
  return promise;
}

/** `{ itemId: points }` over every exchange type of a league. */
export type LeagueHistory = Record<string, HistoryPoint[]>;

export async function fetchLeagueHistory(game: Game, leagueId: string): Promise<LeagueHistory> {
  const files = await Promise.all(
    EXCHANGE_TYPES[game].map((type) =>
      fetchData(dataPaths.history(game, leagueId, type), historyFileSchema).catch((error) => {
        if (error instanceof DataNotFoundError) return null;
        throw error;
      }),
    ),
  );
  return Object.assign({}, ...files.map((file) => file?.items ?? {}));
}

export async function fetchCurrent(game: string, leagueId: string): Promise<CurrentFile> {
  const file = await fetchData(dataPaths.current(game, leagueId), currentFileSchema);
  return { ...file, items: file.items.map((item) => ({ ...item, icon: iconUrl(item.icon) })) };
}

/**
 * Self-hosted icon path (`icons/<file>`) → URL on this site. Anything else (e.g. a
 * remote URL from older data) is dropped: browsers must not call poe.ninja.
 */
export function iconUrl(icon: string): string {
  return icon.startsWith('icons/') ? `${import.meta.env.BASE_URL}data/${icon}` : '';
}

export function fetchPairs(game: Game, leagueId: string): Promise<PairsFile> {
  return fetchData(dataPaths.pairs(game, leagueId), pairsFileSchema);
}

export function fetchFlips(game: string, leagueId: string): Promise<FlipsFile> {
  return fetchData(dataPaths.flips(game, leagueId), flipsFileSchema);
}

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/** Runs `load` whenever `key` changes. */
export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ key: string; value: AsyncState<T> }>({
    key,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) =>
        active &&
        setState({
          key,
          value: {
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          },
        }),
    );
    return () => {
      active = false;
    };
    // `load` is expected to be derived from `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.value : { status: 'loading' };
}

/** Static crafting data (mod list, bases), bundled as hashed assets and fetched on demand. */
export function fetchCraftingData(): Promise<{ mods: CraftingModsFile; bases: CraftingBasesFile }> {
  return Promise.all([
    fetchAsset(craftingModsUrl, craftingModsFileSchema),
    fetchAsset(craftingBasesUrl, craftingBasesFileSchema),
  ]).then(([mods, bases]) => ({ mods, bases }));
}

function fetchAsset<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let promise = cache.get(url) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return schema.parse(await res.json());
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return promise;
}
