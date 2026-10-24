/**
 * Local development data, without network access: rebuilds site files from a checkout of
 * the `data` branch and makes `current.json` from the probe fixtures.
 *   pnpm --filter @poe-tools/data-job dev-data --data-dir <data branch checkout> --out <dir>
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { POE2_EXCHANGE_TYPES, getTrackedLeagues, type CurrentItem } from '@poe-tools/shared';
import { overviewToItems } from './convert.ts';
import { exchangeOverviewSchema } from './poe-ninja/schemas.ts';
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
    rates = { exalted: overview.core.rates.exalted ?? 0, chaos: overview.core.rates.chaos ?? 0 };
    for (const item of overviewToItems(overview, type))
      if (!items.has(item.id)) items.set(item.id, item);
  }
  await site.writeCurrent({
    version: 1,
    leagueId: league.id,
    fetchedAt: new Date().toISOString(),
    rates,
    items: [...items.values()],
  });
}
await site.writeLeagues(leagues, new Date());
console.log(`Site data written to ${outDir}`);
