import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeFlips, type CurrentItem, type ExchangeHour, type League } from '@poe-tools/shared';
import type { NinjaClient } from '../poe-ninja/client.ts';
import type { Logger } from '../run.ts';
import type { createSiteWriter } from '../site.ts';
import { HOUR_S, fetchDigest, newestCompleteHour } from './feed.ts';
import { buildItemMap, digestToHour } from './ingest.ts';
import { WINDOW_HOURS, type WindowStore } from './window.ts';

const BASE_ITEMS_FILE = join(import.meta.dirname, '../../data/exchange-base-items.json');

/** Feed requests per run once the window exists (catching up after skipped runs). */
const MAX_CATCH_UP = 4;

export interface FlipsUpdate {
  client: NinjaClient;
  windows: WindowStore;
  site: ReturnType<typeof createSiteWriter>;
  league: League;
  /** Current poe.ninja items of the league, to map feed ids to item ids. */
  items: readonly CurrentItem[];
  now: Date;
  log: Logger;
  baseItemNames?: Readonly<Record<string, string>> | undefined;
}

/**
 * Adds the missing hours of GGG's currency-exchange feed to the league's rolling window,
 * then publishes the flips of the newest hour (`flips.json`).
 */
export async function updateFlips(options: FlipsUpdate): Promise<void> {
  const { client, windows, site, league, now, log } = options;
  const names =
    options.baseItemNames ??
    (JSON.parse(await readFile(BASE_ITEMS_FILE, 'utf8')) as Record<string, string>);
  const map = buildItemMap(names, options.items);

  const newest = newestCompleteHour(now);
  const oldest = newest - (WINDOW_HOURS - 1) * HOUR_S;
  const hours = new Map<number, ExchangeHour>();
  for (const hour of await windows.read(league.id)) {
    if (hour.epoch >= oldest && hour.epoch <= newest) hours.set(hour.epoch, hour);
  }

  const missing: number[] = [];
  for (let epoch = newest; epoch >= oldest; epoch -= HOUR_S)
    if (!hours.has(epoch)) missing.push(epoch);
  const budget = hours.size === 0 ? WINDOW_HOURS : MAX_CATCH_UP;
  const unknown = new Set<string>();
  for (const epoch of missing.slice(0, budget)) {
    const digest = await fetchDigest(client, epoch);
    if (!digest) {
      log.info(
        `${league.name}: exchange hour ${new Date(epoch * 1000).toISOString()} not available`,
      );
      continue;
    }
    const result = digestToHour(digest, epoch, league.ninjaName, map);
    for (const id of result.unknown) unknown.add(id);
    hours.set(epoch, result.hour);
  }

  const missingNames = [...unknown].filter((id) => !(id in names));
  if (missingNames.length) {
    log.warn(
      `${league.name}: ${missingNames.length} exchange items without a name (e.g. ${missingNames
        .slice(0, 3)
        .join(', ')}): run the base-items probe`,
    );
  }
  if (map.unmatched.length) {
    log.info(`${league.name}: ${map.unmatched.length} exchange items not listed by poe.ninja`);
  }

  const window = [...hours.values()].sort((a, b) => a.epoch - b.epoch);
  await windows.write(league.id, window);
  const file = computeFlips(league.id, window, now);
  await site.writeFlips(file);
  log.info(`${league.name}: ${window.length} exchange hours, ${file.flips.length} flips`);
}
