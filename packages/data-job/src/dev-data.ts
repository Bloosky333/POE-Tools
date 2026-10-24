/**
 * Local development data, without network access: rebuilds site files from a checkout of
 * the `data` branch and makes `current.json` and `flips.json` from the probe fixtures.
 *   pnpm --filter @poe-tools/data-job dev-data --data-dir <data branch checkout> --out <dir>
 */
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { POE2_EXCHANGE_TYPES, getTrackedLeagues, type CurrentItem } from '@poe-tools/shared';
import { overviewToItems } from './convert.ts';
import { HOUR_S } from './exchange/feed.ts';
import { updateFlips } from './exchange/update.ts';
import { createWindowStore } from './exchange/window.ts';
import { createNinjaClient } from './poe-ninja/client.ts';
import { ICONS_DIR, iconFileName } from './icons.ts';
import { exchangeOverviewSchema } from './poe-ninja/schemas.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';
import { exchangeFixture } from './test/fixtures.ts';

const FIXTURES = join(import.meta.dirname, '../../../fixtures/poe-ninja/probe');
const EXCHANGE_FIXTURES = join(import.meta.dirname, '../../../fixtures/ggg-exchange/probe');

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

  // Flips from the captured exchange hours, as if the job ran right after the newest one.
  const epochs = (await readdir(EXCHANGE_FIXTURES))
    .map((name) => /^exchange-(\d+)\.json$/.exec(name)?.[1])
    .filter((epoch): epoch is string => epoch !== undefined)
    .map(Number);
  if (epochs.length) {
    const newest = Math.max(...epochs);
    await updateFlips({
      client: createNinjaClient({
        fetchImpl: async (url) => {
          const body = exchangeFixture(Number(String(url).split('/').pop()));
          return body === null ? new Response('', { status: 404 }) : new Response(body);
        },
        sleep: async () => {},
      }),
      windows: createWindowStore(await mkdtemp(join(tmpdir(), 'poe-tools-window-'))),
      site,
      league,
      items: [...items.values()],
      now: new Date((newest + 2 * HOUR_S + 20 * 60) * 1000),
      log: { info: () => {}, warn: (message) => console.warn(message) },
    });
  }
}
await site.copyIcons(dataDir);
await site.writeLeagues(leagues, new Date());
console.log(`Site data written to ${outDir}`);
