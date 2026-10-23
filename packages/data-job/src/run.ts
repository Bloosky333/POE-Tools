import {
  DAY_MS,
  POE2_EXCHANGE_TYPES,
  getTrackedLeagues,
  utcDate,
  type CurrentItem,
  type League,
} from '@poe-tools/shared';
import {
  DIVINE_ID,
  detailsToDailyPoints,
  fxFromDivineDetails,
  fxFromOverview,
  overviewToItems,
  type DailyPoint,
  type FxPoint,
} from './convert.ts';
import { mergeFx, mergeHistory } from './csv.ts';
import { fetchDetails, fetchLeagues, fetchOverview } from './poe-ninja/api.ts';
import type { NinjaClient } from './poe-ninja/client.ts';
import type { ExchangeOverview } from './poe-ninja/schemas.ts';
import type { createSiteWriter } from './site.ts';
import type { LeagueHistory, Store } from './store.ts';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export interface JobOptions {
  client: NinjaClient;
  store: Store;
  site: ReturnType<typeof createSiteWriter>;
  now: Date;
  log: Logger;
  /** Minimum daily volume (div) for an item to get its full history fetched. */
  backfillMinVolume?: number;
  /** Max new items whose history is fetched in one daily run (after the backfill). */
  newItemsPerRun?: number;
}

interface LeagueSnapshot {
  overviews: ExchangeOverview[];
  items: CurrentItem[];
}

/**
 * One run of the data job (scheduled hourly):
 * - current prices of selectable leagues → site `current.json`;
 * - one-time history backfill of each tracked league (poe.ninja details route);
 * - once per UTC day, closes yesterday: snapshot of every item appended to history;
 * - site history / fx files rebuilt from the store.
 */
export async function runJob(options: JobOptions): Promise<void> {
  const { client, store, site, now, log } = options;
  const today = utcDate(now);
  const yesterday = utcDate(now.getTime() - DAY_MS);

  const ninjaLeagues = new Set((await fetchLeagues(client)).map((league) => league.id));
  const tracked = getTrackedLeagues('poe2');
  checkLeagues(tracked, ninjaLeagues, log);

  for (const league of tracked) {
    if (!ninjaLeagues.has(league.ninjaName)) continue;
    const meta = await store.readMeta(league.id);
    const needsBackfill = meta.backfilledAt === null;
    const needsDaily = meta.lastClosedDate === null || meta.lastClosedDate < yesterday;
    if (!league.selectable && !needsBackfill && !needsDaily) continue;

    const snapshot = await fetchSnapshot(client, league);
    log.info(`${league.name}: ${snapshot.items.length} items`);
    const firstOverview = snapshot.overviews[0];
    if (league.selectable && firstOverview) {
      await site.writeCurrent({
        version: 1,
        leagueId: league.id,
        fetchedAt: now.toISOString(),
        rates: {
          exalted: firstOverview.core.rates.exalted ?? 0,
          chaos: firstOverview.core.rates.chaos ?? 0,
        },
        items: snapshot.items,
      });
    }
    if (!needsBackfill && !needsDaily) continue;

    let history = await store.readHistory(league.id);
    let fx = await store.readFx(league.id);

    const fetched = new Set(meta.detailsFetched);
    const candidates = snapshot.items.filter(
      (item) =>
        item.id !== DIVINE_ID &&
        item.volume >= (options.backfillMinVolume ?? 2) &&
        !fetched.has(item.id),
    );
    const toFetch = needsBackfill ? candidates : candidates.slice(0, options.newItemsPerRun ?? 30);
    const result = toFetch.length
      ? await fetchHistories(client, league, toFetch, today, log)
      : { points: [], fx: [] };
    if (result) {
      fx = mergeFx(fx, result.fx);
      history = addPoints(history, result.points, toFetch);
      meta.detailsFetched.push(...toFetch.map((item) => item.id));
      if (toFetch.length) log.info(`${league.name}: history fetched for ${toFetch.length} items`);
      if (needsBackfill) meta.backfilledAt = now.toISOString();
    }

    // Close yesterday with the current snapshot, unless the details already cover it.
    if (firstOverview) {
      const covered = new Set(
        [...history.values()]
          .flat()
          .filter((p) => p.date === yesterday)
          .map((p) => p.item),
      );
      const points: DailyPoint[] = snapshot.items
        .filter((item) => item.id !== DIVINE_ID && item.price > 0 && !covered.has(item.id))
        .map((item) => ({
          date: yesterday,
          item: item.id,
          price: item.price,
          volume: item.volume,
          source: 'snapshot',
        }));
      history = addPoints(history, points, snapshot.items);
      if (!fx.some((p) => p.date === yesterday)) {
        fx = mergeFx(fx, [fxFromOverview(firstOverview, yesterday)]);
      }
    }
    meta.lastClosedDate = yesterday;

    await store.writeHistory(league.id, history);
    await store.writeFx(league.id, fx);
    await store.writeMeta(league.id, meta);
  }

  for (const league of tracked) {
    await site.writeHistory(league, await store.readHistory(league.id));
    await site.writeFx(league, await store.readFx(league.id));
  }
  await site.writeLeagues(tracked, now);
}

function checkLeagues(tracked: readonly League[], ninjaLeagues: Set<string>, log: Logger) {
  for (const league of tracked) {
    if (!ninjaLeagues.has(league.ninjaName) && league.endsAt === null) {
      log.warn(`League "${league.ninjaName}" not listed by poe.ninja: update leagues.ts`);
    }
  }
  const known = new Set(tracked.map((league) => league.ninjaName));
  for (const id of ninjaLeagues) {
    if (!known.has(id) && !id.startsWith('HC ') && id !== 'Standard' && id !== 'Hardcore') {
      log.warn(`poe.ninja lists unknown league "${id}": new league? update leagues.ts`);
    }
  }
}

async function fetchSnapshot(client: NinjaClient, league: League): Promise<LeagueSnapshot> {
  const overviews: ExchangeOverview[] = [];
  const items = new Map<string, CurrentItem>();
  for (const type of POE2_EXCHANGE_TYPES) {
    const overview = await fetchOverview(client, league.ninjaName, type);
    overviews.push(overview);
    for (const item of overviewToItems(overview, type)) {
      if (!items.has(item.id)) items.set(item.id, item);
    }
  }
  return { overviews, items: [...items.values()] };
}

async function fetchHistories(
  client: NinjaClient,
  league: League,
  items: readonly CurrentItem[],
  today: string,
  log: Logger,
): Promise<{ points: DailyPoint[]; fx: FxPoint[] } | null> {
  const divine = await fetchDetails(client, league.ninjaName, 'Currency', 'divine-orb');
  if (!divine) {
    log.warn(`${league.name}: Divine Orb details not found, history fetch postponed`);
    return null;
  }
  const fx = fxFromDivineDetails(divine, today);
  const fxByDate = new Map(fx.map((point) => [point.date, point]));

  const points: DailyPoint[] = [];
  let deviations = 0;
  for (const item of items) {
    let details;
    try {
      details = await fetchDetails(client, league.ninjaName, item.type, item.detailsId);
    } catch (error) {
      log.warn(`${league.name}: details failed for ${item.type}/${item.detailsId}: ${error}`);
      continue;
    }
    if (!details) {
      log.warn(`${league.name}: no details for ${item.type}/${item.detailsId}`);
      continue;
    }
    const itemPoints = detailsToDailyPoints(details, item.id, fxByDate, today);
    // Sanity check of the pair-rate conversion against the overview price.
    const last = itemPoints.at(-1);
    if (last && Math.abs(last.price / item.price - 1) > 0.5) deviations++;
    points.push(...itemPoints);
  }
  if (deviations > items.length * 0.2) {
    log.warn(
      `${league.name}: ${deviations}/${items.length} items deviate >50% from the overview price`,
    );
  }
  return { points, fx };
}

/** Adds points to the history of each item's exchange type. */
function addPoints(
  history: LeagueHistory,
  points: readonly DailyPoint[],
  items?: readonly CurrentItem[],
): LeagueHistory {
  const typeOf = new Map<string, CurrentItem['type']>();
  for (const [type, existing] of history) for (const p of existing) typeOf.set(p.item, type);
  for (const item of items ?? []) if (!typeOf.has(item.id)) typeOf.set(item.id, item.type);

  const byType = new Map<CurrentItem['type'], DailyPoint[]>();
  for (const point of points) {
    const type = typeOf.get(point.item);
    if (!type) continue;
    const list = byType.get(type) ?? [];
    list.push(point);
    byType.set(type, list);
  }
  const next: LeagueHistory = new Map(history);
  for (const [type, incoming] of byType)
    next.set(type, mergeHistory(next.get(type) ?? [], incoming));
  return next;
}
