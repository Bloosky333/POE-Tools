import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ECONOMY, EXCHANGE_TYPES, type ExchangeType, type Game } from '@poe-tools/shared';
import { z } from 'zod';
import type { DailyPoint, FxPoint } from './convert.ts';
import {
  formatFxCsv,
  formatHistoryCsv,
  formatPairsCsv,
  parseFxCsv,
  parseHistoryCsv,
  parsePairsCsv,
} from './csv.ts';
import type { PairPoint } from './pairs.ts';

/**
 * Persistent store, kept on the orphan `data` branch:
 *   <game>/<leagueId>/meta.json
 *   <game>/<leagueId>/fx.csv
 *   <game>/<leagueId>/history/<ExchangeType>.csv
 *   <game>/<leagueId>/pairs/<ExchangeType>.csv   (daily rate per pay currency)
 */

/** Bump to re-run the history backfill of every league (e.g. after a conversion fix). */
export const BACKFILL_VERSION = 2;

export const metaSchema = z.object({
  /** When the one-time history backfill completed. */
  backfilledAt: z.string().nullable(),
  /** `BACKFILL_VERSION` the backfill was made with. */
  backfillVersion: z.number().default(1),
  /** Latest completed UTC date present in history. */
  lastClosedDate: z.string().nullable(),
  /** Items whose details history was fetched (a re-backfill refetches all of them). */
  detailsFetched: z.array(z.string()),
});
export type LeagueMeta = z.infer<typeof metaSchema>;

const EMPTY_META: LeagueMeta = {
  backfilledAt: null,
  backfillVersion: BACKFILL_VERSION,
  lastClosedDate: null,
  detailsFetched: [],
};

export type LeagueHistory = Map<ExchangeType, DailyPoint[]>;
export type LeaguePairs = Map<ExchangeType, PairPoint[]>;

export function createStore(root: string, game: Game = 'poe2') {
  const leagueDir = (leagueId: string) => join(root, game, leagueId);
  const { unit, fxCurrencies } = ECONOMY[game];

  async function readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async function writeText(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }

  return {
    /** Root directory of the store (also holds `icons/`). */
    root,
    game,
    async readMeta(leagueId: string): Promise<LeagueMeta> {
      const text = await readText(join(leagueDir(leagueId), 'meta.json'));
      return text ? metaSchema.parse(JSON.parse(text)) : structuredClone(EMPTY_META);
    },
    async writeMeta(leagueId: string, meta: LeagueMeta): Promise<void> {
      const sorted = { ...meta, detailsFetched: [...new Set(meta.detailsFetched)].sort() };
      await writeText(
        join(leagueDir(leagueId), 'meta.json'),
        JSON.stringify(sorted, null, 2) + '\n',
      );
    },
    async readFx(leagueId: string): Promise<FxPoint[]> {
      const text = await readText(join(leagueDir(leagueId), 'fx.csv'));
      return text ? parseFxCsv(text, fxCurrencies) : [];
    },
    async writeFx(leagueId: string, points: readonly FxPoint[]): Promise<void> {
      await writeText(join(leagueDir(leagueId), 'fx.csv'), formatFxCsv(points, unit, fxCurrencies));
    },
    async readHistory(leagueId: string): Promise<LeagueHistory> {
      const history: LeagueHistory = new Map();
      for (const type of EXCHANGE_TYPES[game]) {
        const text = await readText(join(leagueDir(leagueId), 'history', `${type}.csv`));
        history.set(type, text ? parseHistoryCsv(text) : []);
      }
      return history;
    },
    async writeHistory(leagueId: string, history: LeagueHistory): Promise<void> {
      for (const [type, points] of history) {
        if (!points.length) continue;
        await writeText(
          join(leagueDir(leagueId), 'history', `${type}.csv`),
          formatHistoryCsv(points, unit),
        );
      }
    },
    async readPairs(leagueId: string): Promise<LeaguePairs> {
      const pairs: LeaguePairs = new Map();
      for (const type of EXCHANGE_TYPES[game]) {
        const text = await readText(join(leagueDir(leagueId), 'pairs', `${type}.csv`));
        pairs.set(type, text ? parsePairsCsv(text) : []);
      }
      return pairs;
    },
    async writePairs(leagueId: string, pairs: LeaguePairs): Promise<void> {
      for (const [type, points] of pairs) {
        if (!points.length) continue;
        await writeText(
          join(leagueDir(leagueId), 'pairs', `${type}.csv`),
          formatPairsCsv(points, unit),
        );
      }
    },
  };
}

export type Store = ReturnType<typeof createStore>;
