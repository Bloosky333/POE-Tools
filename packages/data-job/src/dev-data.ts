/**
 * Local development data, without network access: rebuilds site files from a checkout of
 * the `data` branch and makes `current.json`, `pairs.json` and `flips.json` from the probe
 * fixtures, for every tracked league that has fixtures (PoE 2: Forbidden Rites, PoE 1:
 * Allflame).
 *   pnpm --filter @poe-tools/data-job dev-data --data-dir <data branch checkout> --out <dir>
 */
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  CORE_CURRENCIES,
  DAY_MS,
  ECONOMY,
  ENABLED_GAMES,
  EXCHANGE_TYPES,
  getTrackedLeagues,
  type CurrentFile,
  type CurrentItem,
  type ExchangeType,
  type Game,
  type League,
} from '@poe-tools/shared';
import { overviewToItems } from './convert.ts';
import { HOUR_S } from './exchange/feed.ts';
import { updateFlips } from './exchange/update.ts';
import { createWindowStore } from './exchange/window.ts';
import { createNinjaClient } from './poe-ninja/client.ts';
import { ICONS_DIR, iconFileName } from './icons.ts';
import { buildPairQuotes, busiestPairs } from './pairs.ts';
import { exchangeOverviewSchema, type ExchangeOverview } from './poe-ninja/schemas.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';

const FIXTURES = join(import.meta.dirname, '../../../fixtures');

/** Where each game's probe fixtures live and how its files are named. */
const SOURCES: Record<
  Game,
  {
    league: string;
    overview: (type: ExchangeType) => string;
    exchangeDir: string;
  }
> = {
  poe2: {
    league: 'forbidden-rites',
    overview: (type) =>
      `poe-ninja/probe/exchange-overview-${type.toLowerCase()}-forbidden-rites.json`,
    exchangeDir: 'ggg-exchange/probe',
  },
  poe1: {
    league: 'allflame',
    overview: (type) => `poe1/overview-${type.toLowerCase()}.json`,
    exchangeDir: 'poe1',
  },
};

const { values } = parseArgs({
  options: { 'data-dir': { type: 'string' }, out: { type: 'string' } },
});
const dataDir = values['data-dir'] ?? '';
const outDir = values.out ?? '';
if (!dataDir || !outDir) {
  console.error('Usage: dev-data --data-dir <dir> --out <dir>');
  process.exit(2);
}

for (const game of ENABLED_GAMES) {
  const store = createStore(dataDir, game);
  const site = createSiteWriter(outDir, game);
  const leagues = getTrackedLeagues(game);
  for (const league of leagues) {
    await site.writeHistory(league, await store.readHistory(league.id));
    await site.writeFx(league, await store.readFx(league.id));
    if (league.id === SOURCES[game].league) await writeCurrentData(game, league);
  }
  await site.writeLeagues(leagues, new Date());

  async function writeCurrentData(game: Game, league: League) {
    const source = SOURCES[game];
    const items = new Map<string, CurrentItem>();
    const overviews: ExchangeOverview[] = [];
    let rates: CurrentFile['rates'] = {};
    for (const type of EXCHANGE_TYPES[game]) {
      let text: string;
      try {
        text = await readFile(join(FIXTURES, source.overview(type)), 'utf8');
      } catch {
        continue;
      }
      const overview = exchangeOverviewSchema.parse(JSON.parse(text));
      overviews.push(overview);
      rates = {};
      for (const currency of CORE_CURRENCIES) {
        const rate = overview.core.rates[currency];
        if (rate) rates[currency] = rate;
      }
      for (const item of overviewToItems(overview, type))
        if (!items.has(item.id)) items.set(item.id, item);
    }
    // No network: keep icons already in the data branch, others stay empty.
    const icons = new Set(await readdir(join(dataDir, ICONS_DIR)).catch(() => []));
    await site.writeCurrent({
      version: 1,
      leagueId: league.id,
      fetchedAt: new Date().toISOString(),
      unit: ECONOMY[game].unit,
      rates,
      items: [...items.values()].map((item) => {
        const file = iconFileName(item.icon);
        return { ...item, icon: file && icons.has(file) ? `${ICONS_DIR}/${file}` : '' };
      }),
    });
    // Stored daily rates may be older than the 7-day limit: date them from the newest row.
    const pairPoints = [...(await store.readPairs(league.id)).values()].flat();
    const newest = pairPoints.reduce((max, p) => (p.date > max ? p.date : max), '');
    const now = newest ? new Date(Date.parse(newest) + DAY_MS) : new Date();
    await site.writePairs({
      version: 1,
      leagueId: league.id,
      generatedAt: now.toISOString(),
      items: buildPairQuotes(pairPoints, busiestPairs(overviews), now),
    });

    // Flips from the captured exchange hours, as if the job ran right after the newest one.
    const exchangeDir = join(FIXTURES, source.exchangeDir);
    const epochs = (await readdir(exchangeDir))
      .map((name) => /^exchange-(\d+)\.json$/.exec(name)?.[1])
      .filter((epoch): epoch is string => epoch !== undefined)
      .map(Number);
    if (!epochs.length) return;
    const newestHour = Math.max(...epochs);
    await updateFlips({
      client: createNinjaClient({
        fetchImpl: async (url) => {
          const epoch = String(url).split('/').pop();
          try {
            return new Response(await readFile(join(exchangeDir, `exchange-${epoch}.json`)));
          } catch {
            return new Response('', { status: 404 });
          }
        },
        sleep: async () => {},
      }),
      windows: createWindowStore(await mkdtemp(join(tmpdir(), 'poe-tools-window-')), game),
      site,
      league,
      game,
      items: [...items.values()],
      now: new Date((newestHour + 2 * HOUR_S + 20 * 60) * 1000),
      log: { info: () => {}, warn: (message) => console.warn(message) },
    });
  }
}
await createSiteWriter(outDir).copyIcons(dataDir);
console.log(`Site data written to ${outDir}`);
