/**
 * Regenerates `data/exchange-base-items[-poe1].json`: names of the base item ids used by
 * GGG's currency-exchange feed (`Metadata/Items/...`), from the RePoE export of the game
 * (`GAME` env, default poe2). The data job matches these names against poe.ninja items. Run
 * via the probe workflow (`source: base-items`, `game`) when the job warns about unmapped
 * ids (new league / patch).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GAMES, type Game } from '@poe-tools/shared';
import { z } from 'zod';
import { EXCHANGE_FEED_URLS } from './exchange/feed.ts';
import { BASE_ITEMS_FILES } from './exchange/update.ts';
import { createNinjaClient } from './poe-ninja/client.ts';

const game: Game = GAMES.find((g) => g === process.env.GAME) ?? 'poe2';
const REPOE_URLS: Record<Game, string> = {
  poe2: 'https://repoe-fork.github.io/poe2/base_items.json',
  poe1: 'https://repoe-fork.github.io/base_items.json',
};
const REPOE_URL = REPOE_URLS[game];
const OUT_FILE = BASE_ITEMS_FILES[game];
const HOURS = 24;
const HOUR = 3600;

const baseItemsSchema = z.record(z.string(), z.object({ name: z.string().optional() }).loose());
const marketsSchema = z.object({
  markets: z.array(z.object({ market_pair: z.array(z.string()) }).loose()),
});

async function main() {
  const client = createNinjaClient();
  const ids = new Set<string>();
  try {
    const previous = JSON.parse(await readFile(OUT_FILE, 'utf8')) as Record<string, string>;
    for (const id of Object.keys(previous)) ids.add(id);
  } catch {
    // first run
  }

  const newest = Math.floor(Date.now() / 1000 / HOUR) * HOUR - 2 * HOUR;
  for (let i = 0; i < HOURS; i++) {
    const res = await client.get(`${EXCHANGE_FEED_URLS[game]}/${newest - i * HOUR}`);
    console.log(`${res.status} ${res.url}`);
    if (res.status !== 200) continue;
    for (const market of marketsSchema.parse(JSON.parse(res.body)).markets) {
      for (const id of market.market_pair) ids.add(id);
    }
  }

  const res = await client.get(REPOE_URL);
  console.log(`${res.status} ${res.url}`);
  if (res.status !== 200) throw new Error(`RePoE: HTTP ${res.status}`);
  const baseItems = baseItemsSchema.parse(JSON.parse(res.body));

  const names: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of [...ids].sort()) {
    const name = baseItems[id]?.name;
    if (name) names[id] = name;
    else missing.push(id);
  }
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(names, null, 2) + '\n');
  console.log(`${Object.keys(names).length} names written, ${missing.length} ids without name`);
  for (const id of missing) console.log(`::warning::No RePoE name for ${id}`);
}

await main();
