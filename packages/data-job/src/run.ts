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
import { BACKFILL_VERSION, type LeagueHistory, type Store } from './store.ts';

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
  /** Minimum daily volume (div) for an item to get its details history. */
  historyMinVolume?: number;
  /** Max items whose details history is refreshed per league per day. */
  maxHistoryItems?: number;
}

interface LeagueSnapshot {
  overviews: ExchangeOverview[];
  items: CurrentItem[];
}

/**
 * One run of the data job (scheduled hourly):
 * - current prices of selectable leagues → site `current.json`;
 * - once per league (or per `BACKFILL_VERSION`): full history of every liquid item from
 *   poe.ninja's details route;
 * - once per UTC day, for selectable leagues: refresh of those histories (details are
 *   the single source of an item's history, so its series stays consistent); items
 *   without details history get yesterday's overview snapshot instead;
 * - site history / fx files rebuilt from the store.
 */
export async function runJob(options: JobOptions): Promise<void> {
  const { client, store, site, now, log } = options;
  const minVolume = options.historyMinVolume ?? 2;
  const maxItems = options.maxHistoryItems ?? 400;
  const today = utcDate(now);
  const yesterday = utcDate(now.getTime() - DAY_MS);

  const ninjaLeagues = new Set((await fetchLeagues(client)).map((league) => league.id));
  const tracked = getTrackedLeagues('poe2');
  checkLeagues(tracked, ninjaLeagues, log);

  for (const league of tracked) {
    if (!ninjaLeagues.has(league.ninjaName)) continue;
    const meta = await store.readMeta(league.id);
    const needsBackfill = meta.backfilledAt === null || meta.backfillVersion !== BACKFILL_VERSION;
    const needsDaily = meta.lastClosedDate === null || meta.lastClosedDate < yesterday;
    if (!league.selectable && !needsBackfill) continue;

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
    if (!needsBackfill && !(league.selectable && needsDaily)) continue;

    let history = await store.readHistory(league.id);
    let fx = await store.readFx(league.id);
    if (needsBackfill && meta.backfilledAt !== null) {
      log.info(`${league.name}: re-running backfill v${BACKFILL_VERSION}`);
      history = new Map(
        [...history].map(([type, points]) => [type, points.filter((p) => p.source === 'snapshot')]),
      );
      meta.detailsFetched = [];
    }

    // Items with details history: previously fetched ones plus newly liquid ones.
    const fetched = new Set(meta.detailsFetched);
    const toFetch = snapshot.items
      .filter((item) => item.id !== DIVINE_ID && (fetched.has(item.id) || item.volume >= minVolume))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, maxItems);
    const result = toFetch.length
      ? await fetchHistories(client, league, toFetch, today, log)
      : { points: [], fx: [], fetched: [] };
    if (!result) {
      log.warn(`${league.name}: history refresh postponed`);
    } else {
      fx = mergeFx(fx, result.fx);
      history = replaceItemHistories(history, result.points, toFetch);
      meta.detailsFetched = [...new Set([...meta.detailsFetched, ...result.fetched])];
      log.info(`${league.name}: history refreshed for ${result.fetched.length} items`);
      if (needsBackfill) {
        meta.backfilledAt = now.toISOString();
        meta.backfillVersion = BACKFILL_VERSION;
      }
    }

    // Close yesterday: overview snapshot for items without details history.
    if (firstOverview && league.selectable) {
      const withDetails = new Set(meta.detailsFetched);
      const points: DailyPoint[] = snapshot.items
        .filter((item) => item.id !== DIVINE_ID && item.price > 0 && !withDetails.has(item.id))
        .map((item) => ({
          date: yesterday,
          item: item.id,
          price: item.price,
          volume: item.volume,
          source: 'snapshot',
        }));
      history = addSnapshotPoints(history, points, snapshot.items);
      if (!fx.some((p) => p.date === yesterday)) {
        fx = mergeFx(fx, [fxFromOverview(firstOverview, yesterday)]);
      }
    }
    if (result) meta.lastClosedDate = yesterday;

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
): Promise<{ points: DailyPoint[]; fx: FxPoint[]; fetched: string[] } | null> {
  const divine = await fetchDetails(client, league.ninjaName, 'Currency', 'divine-orb');
  if (!divine) {
    log.warn(`${league.name}: Divine Orb details not found`);
    return null;
  }
  const fx = fxFromDivineDetails(divine, today);
  const fxByDate = new Map(fx.map((point) => [point.date, point]));

  const points: DailyPoint[] = [];
  const fetched: string[] = [];
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
    points.push(...detailsToDailyPoints(details, item.id, fxByDate, today));
    fetched.push(item.id);
  }
  return { points, fx, fetched };
}

/** Replaces the whole history of every item in `items` that has new points. */
function replaceItemHistories(
  history: LeagueHistory,
  points: readonly DailyPoint[],
  items: readonly CurrentItem[],
): LeagueHistory {
  const replaced = new Set(points.map((p) => p.item));
  const typeOf = new Map(items.map((item) => [item.id, item.type]));
  const next: LeagueHistory = new Map(
    [...history].map(([type, list]) => [type, list.filter((p) => !replaced.has(p.item))]),
  );
  for (const point of points) {
    const type = typeOf.get(point.item);
    if (type) next.set(type, [...(next.get(type) ?? []), point]);
  }
  return next;
}

/** Adds snapshot points to the history of each item's exchange type. */
function addSnapshotPoints(
  history: LeagueHistory,
  points: readonly DailyPoint[],
  items: readonly CurrentItem[],
): LeagueHistory {
  const typeOf = new Map(items.map((item) => [item.id, item.type]));
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
