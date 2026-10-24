import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  dataPaths,
  leagueDayOfDate,
  type CurrentFile,
  type FlipsFile,
  type FxFile,
  type HistoryFile,
  type League,
  type LeaguesFile,
  type PairsFile,
} from '@poe-tools/shared';
import type { DailyPoint, FxPoint } from './convert.ts';
import { ICONS_DIR } from './icons.ts';
import type { LeagueHistory } from './store.ts';

/** Writes the JSON files the web app reads (`apps/web/public/data` in CI). */
export function createSiteWriter(outDir: string, game = 'poe2') {
  async function writeJson(relativePath: string, value: unknown) {
    const path = join(outDir, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value));
  }

  return {
    /** Publishes the stored icons under `<out>/icons/`. */
    async copyIcons(storeDir: string) {
      await cp(join(storeDir, ICONS_DIR), join(outDir, ICONS_DIR), {
        recursive: true,
        force: true,
      }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    },
    writeLeagues(leagues: readonly League[], now: Date) {
      const file: LeaguesFile = {
        version: 1,
        generatedAt: now.toISOString(),
        leagues: [...leagues],
      };
      return writeJson(dataPaths.leagues(game), file);
    },
    writeCurrent(file: CurrentFile) {
      return writeJson(dataPaths.current(game, file.leagueId), file);
    },
    writeFlips(file: FlipsFile) {
      return writeJson(dataPaths.flips(game, file.leagueId), file);
    },
    async writeHistory(league: League, history: LeagueHistory) {
      for (const [type, points] of history) {
        const file: HistoryFile = {
          version: 1,
          leagueId: league.id,
          type,
          items: toSeries(league, points),
        };
        await writeJson(dataPaths.history(game, league.id, type), file);
      }
    },
    writePairs(file: PairsFile) {
      return writeJson(dataPaths.pairs(game, file.leagueId), file);
    },
    writeFx(league: League, points: readonly FxPoint[]) {
      const file: FxFile = {
        version: 1,
        leagueId: league.id,
        points: points
          .map((p) => [leagueDayOfDate(league.startsAt, p.date), p.exalted, p.chaos] as const)
          .filter(([day]) => day >= 0)
          .sort((a, b) => a[0] - b[0])
          .map(([day, exalted, chaos]) => [day, exalted, chaos]),
      };
      return writeJson(dataPaths.fx(game, league.id), file);
    },
  };
}

export function toSeries(league: League, points: readonly DailyPoint[]): HistoryFile['items'] {
  const series: HistoryFile['items'] = {};
  for (const point of points) {
    const day = leagueDayOfDate(league.startsAt, point.date);
    if (day < 0) continue;
    (series[point.item] ??= []).push([day, point.price, point.volume]);
  }
  for (const list of Object.values(series)) list.sort((a, b) => a[0] - b[0]);
  return series;
}
