/**
 * Local development data, without network access: rebuilds site files from a checkout of
 * the `data` branch and makes `current.json` from the probe fixtures.
 *   pnpm --filter @poe-tools/data-job dev-data --data-dir <data branch checkout> --out <dir>
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  DAY_MS,
  POE2_EXCHANGE_TYPES,
  getTrackedLeagues,
  type CurrentItem,
} from '@poe-tools/shared';
import { overviewToItems } from './convert.ts';
import { ICONS_DIR, iconFileName } from './icons.ts';
import { buildPairQuotes, busiestPairs } from './pairs.ts';
import { exchangeOverviewSchema, type ExchangeOverview } from './poe-ninja/schemas.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';

const FIXTURES = join(import.meta.dirname, '../../../fixtures/poe-ninja/probe');

const { values } = parseArgs({
  options: { 'data-dir': { type: 'string' }, out: { type: 'string' } },
});
const dataDir = values['data-dir'];
const outDir = values.out;
if (!dataDir || !outDir) {
  console.error('Usage: dev-data --data-dir <dir> --out <dir>');
  process.exit(2);
}

const store = createStore(dataDir);
const site = createSiteWriter(outDir);
const leagues = getTrackedLeagues('poe2');
for (const league of leagues) {
  await site.writeHistory(league, await store.readHistory(league.id));
  await site.writeFx(league, await store.readFx(league.id));
  if (!league.selectable) continue;

  const items = new Map<string, CurrentItem>();
  const overviews: ExchangeOverview[] = [];
  let rates = { exalted: 0, chaos: 0 };
  for (const type of POE2_EXCHANGE_TYPES) {
    const file = join(FIXTURES, `exchange-overview-${type.toLowerCase()}-${league.id}.json`);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const overview = exchangeOverviewSchema.parse(JSON.parse(text));
    overviews.push(overview);
    rates = { exalted: overview.core.rates.exalted ?? 0, chaos: overview.core.rates.chaos ?? 0 };
    for (const item of overviewToItems(overview, type))
      if (!items.has(item.id)) items.set(item.id, item);
  }
  // No network: keep icons already in the data branch, others stay empty.
  const icons = new Set(await readdir(join(dataDir, ICONS_DIR)).catch(() => []));
  await site.writeCurrent({
    version: 1,
    leagueId: league.id,
    fetchedAt: new Date().toISOString(),
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
}
await site.copyIcons(dataDir);
await site.writeLeagues(leagues, new Date());
console.log(`Site data written to ${outDir}`);
