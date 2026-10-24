import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { POE2_EXCHANGE_TYPES, type ExchangeType } from '@poe-tools/shared';
import { z } from 'zod';
import type { DailyPoint, FxPoint } from './convert.ts';
import { formatFxCsv, formatHistoryCsv, parseFxCsv, parseHistoryCsv } from './csv.ts';

/**
 * Persistent store, kept on the orphan `data` branch:
 *   <game>/<leagueId>/meta.json
 *   <game>/<leagueId>/fx.csv
 *   <game>/<leagueId>/history/<ExchangeType>.csv
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
  /** Items whose details history was already fetched (or attempted). */
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

export function createStore(root: string, game = 'poe2') {
  const leagueDir = (leagueId: string) => join(root, game, leagueId);

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
      return text ? parseFxCsv(text) : [];
    },
    async writeFx(leagueId: string, points: readonly FxPoint[]): Promise<void> {
      await writeText(join(leagueDir(leagueId), 'fx.csv'), formatFxCsv(points));
    },
    async readHistory(leagueId: string): Promise<LeagueHistory> {
      const history: LeagueHistory = new Map();
      for (const type of POE2_EXCHANGE_TYPES) {
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
          formatHistoryCsv(points),
        );
      }
    },
  };
}

export type Store = ReturnType<typeof createStore>;
