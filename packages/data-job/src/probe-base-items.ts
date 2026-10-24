/**
 * Regenerates `data/exchange-base-items.json`: names of the base item ids used by GGG's
 * currency-exchange feed (`Metadata/Items/...`), from the RePoE PoE 2 export. The data job
 * matches these names against poe.ninja items. Run via the probe workflow
 * (`source: base-items`) when the job warns about unmapped ids (new league / patch).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { EXCHANGE_FEED_URL } from './exchange/feed.ts';
import { createNinjaClient } from './poe-ninja/client.ts';

const REPOE_URL = 'https://repoe-fork.github.io/poe2/base_items.json';
const OUT_FILE = join(import.meta.dirname, '../data/exchange-base-items.json');
const HOURS = 6;
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
    const res = await client.get(`${EXCHANGE_FEED_URL}/${newest - i * HOUR}`);
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
