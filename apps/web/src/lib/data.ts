import craftingBasesPoe1Url from '@poe-tools/shared/data/crafting-bases-poe1.json?url';
import craftingBasesPoe2Url from '@poe-tools/shared/data/crafting-bases-poe2.json?url';
import craftingModsPoe1Url from '@poe-tools/shared/data/crafting-mods-poe1.json?url';
import craftingModsPoe2Url from '@poe-tools/shared/data/crafting-mods-poe2.json?url';
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
 * Site data published by the data job under `<base>/data/` (refreshed hourly). Files are
 * validated and cached by URL; site data is fetched again once older than `DATA_MAX_AGE_MS`,
 * so a tab left open picks up new prices (see `useAsync`).
 */

const DATA_MAX_AGE_MS = 15 * 60 * 1000;

const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

class DataNotFoundError extends Error {}

export function fetchData<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return cachedFetch(`${import.meta.env.BASE_URL}data/${path}`, schema, DATA_MAX_AGE_MS);
}

function cachedFetch<T>(url: string, schema: z.ZodType<T>, maxAgeMs: number): Promise<T> {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.at < maxAgeMs) return entry.promise as Promise<T>;
  const promise = fetch(url).then(async (res) => {
    if (res.status === 404) throw new DataNotFoundError(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return schema.parse(await res.json());
  });
  promise.catch(() => cache.delete(url));
  cache.set(url, { at: Date.now(), promise });
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

const REFRESH_MS = 15 * 60 * 1000;

/**
 * Runs `load` whenever `key` changes, then again every 15 minutes: new data replaces the
 * shown one without a loading state, a failed refresh keeps it, and an error is retried.
 */
export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ key: string; value: AsyncState<T> }>({
    key,
    value: { status: 'loading' },
  });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefresh((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) =>
        active &&
        setState((prev) =>
          prev.key === key && prev.value.status === 'ready'
            ? prev
            : {
                key,
                value: {
                  status: 'error',
                  error: error instanceof Error ? error : new Error(String(error)),
                },
              },
        ),
    );
    return () => {
      active = false;
    };
    // `load` is expected to be derived from `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh]);
  return state.key === key ? state.value : { status: 'loading' };
}

const CRAFTING_URLS: Record<Game, { mods: string; bases: string }> = {
  poe2: { mods: craftingModsPoe2Url, bases: craftingBasesPoe2Url },
  poe1: { mods: craftingModsPoe1Url, bases: craftingBasesPoe1Url },
};

/** Static crafting data (mod list, bases), bundled as hashed assets and fetched on demand. */
export function fetchCraftingData(
  game: Game,
): Promise<{ mods: CraftingModsFile; bases: CraftingBasesFile }> {
  return Promise.all([
    fetchAsset(CRAFTING_URLS[game].mods, craftingModsFileSchema),
    fetchAsset(CRAFTING_URLS[game].bases, craftingBasesFileSchema),
  ]).then(([mods, bases]) => ({ mods, bases }));
}

/** Hashed build assets never change: cached for the page's life. */
function fetchAsset<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  return cachedFetch(url, schema, Infinity);
}
