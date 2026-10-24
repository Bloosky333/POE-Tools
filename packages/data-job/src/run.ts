import {
  CORE_CURRENCIES,
  DAY_MS,
  ECONOMY,
  EXCHANGE_TYPES,
  getTrackedLeagues,
  hasStarted,
  utcDate,
  type CurrentFile,
  type CurrentItem,
  type ExchangeType,
  type Game,
  type League,
} from '@poe-tools/shared';
import {
  CURRENCY_DETAILS_ID,
  detailsToDailyPoints,
  fxFromOverview,
  fxFromUnitDetails,
  overviewToItems,
  type DailyPoint,
  type FxPoint,
} from './convert.ts';
import { mergeFx, mergeHistory } from './csv.ts';
import { updateFlips } from './exchange/update.ts';
import type { WindowStore } from './exchange/window.ts';
import { syncIcons } from './icons.ts';
import {
  buildPairQuotes,
  busiestPairs,
  detailsToPairPoints,
  type BusiestPair,
  type PairPoint,
} from './pairs.ts';
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
  /** Rolling windows of GGG exchange data; flips are not computed without it. */
  windows?: WindowStore | undefined;
  now: Date;
  log: Logger;
  /** Minimum daily volume (game unit) for an item to get its details history. */
  historyMinVolume?: number;
  /** Max items whose details history is refreshed per league per day. */
  maxHistoryItems?: number;
  /** fetch used to download icons from GGG's CDN (tests inject a fake). */
  iconFetch?: typeof fetch;
}

const CURRENCY_NAMES: Record<string, string> = {
  divine: 'Divine Orb',
  exalted: 'Exalted Orb',
  chaos: 'Chaos Orb',
};

interface LeagueSnapshot {
  overviews: ExchangeOverview[];
  items: CurrentItem[];
}

/**
 * One run of the data job for the store's game (scheduled hourly):
 * - current prices of selectable leagues → site `current.json`;
 * - once per league (or per `BACKFILL_VERSION`): full history of every liquid item from
 *   poe.ninja's details route;
 * - once per UTC day, for selectable leagues: refresh of those histories (details are
 *   the single source of an item's history, so its series stays consistent); items
 *   without details history get yesterday's overview snapshot instead; the same details
 *   give the daily rate per pay currency (`pairs/`);
 * - selectable leagues: newest hour of GGG's currency-exchange feed → site `flips.json`;
 * - site history / fx files rebuilt from the store; per-pair rates (`pairs.json`) of
 *   selectable leagues from the store plus the hourly busiest pair.
 *
 * Leagues not listed by poe.ninja are skipped, except ended ones (their data stays
 * available); a league is backfilled once more after its end so its curve is complete.
 */
export async function runJob(options: JobOptions): Promise<void> {
  const { client, store, site, now, log } = options;
  const game: Game = store.game;
  const economy = ECONOMY[game];
  const minVolume = options.historyMinVolume ?? economy.historyMinVolume;
  const maxItems = options.maxHistoryItems ?? 400;
  const today = utcDate(now);
  const yesterday = utcDate(now.getTime() - DAY_MS);

  const listed = (await fetchLeagues(client, game)).map((league) => league.id);
  const ninjaLeagues = new Set(listed);
  const tracked = resolveNinjaNames(getTrackedLeagues(game), listed, now, log);
  checkLeagues(tracked, ninjaLeagues, now, log);
  const busiestByLeague = new Map<string, Map<string, BusiestPair>>();

  for (const league of tracked) {
    const ended = league.endsAt !== null && Date.parse(league.endsAt) <= now.getTime();
    if (!hasStarted(league, now) || (!ninjaLeagues.has(league.ninjaName) && !ended)) continue;
    const meta = await store.readMeta(league.id);
    const needsBackfill =
      meta.backfilledAt === null ||
      meta.backfillVersion !== BACKFILL_VERSION ||
      (ended && meta.backfilledAt < (league.endsAt ?? ''));
    const needsDaily = meta.lastClosedDate === null || meta.lastClosedDate < yesterday;
    if (!league.selectable && !needsBackfill) continue;

    const snapshot = await fetchSnapshot(client, game, league);
    log.info(`${league.name}: ${snapshot.items.length} items`);
    const firstOverview = snapshot.overviews[0];
    if (league.selectable) busiestByLeague.set(league.id, busiestPairs(snapshot.overviews));
    if (league.selectable && firstOverview) {
      const items = await syncIcons(snapshot.items, {
        storeDir: store.root,
        client,
        log,
        ...(options.iconFetch ? { fetchImpl: options.iconFetch } : {}),
      });
      await site.writeCurrent({
        version: 1,
        leagueId: league.id,
        fetchedAt: now.toISOString(),
        unit: economy.unit,
        rates: coreRates(firstOverview),
        items,
      });
    }
    if (league.selectable && options.windows) {
      try {
        await updateFlips({
          client,
          windows: options.windows,
          site,
          league,
          game,
          items: snapshot.items,
          now,
          log,
        });
      } catch (error) {
        log.warn(`${league.name}: flips not updated: ${error}`);
      }
    }
    if (!needsBackfill && !(league.selectable && needsDaily)) continue;

    let history = await store.readHistory(league.id);
    let fx = await store.readFx(league.id);
    let pairs = await store.readPairs(league.id);
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
      .filter(
        (item) => item.id !== economy.unit && (fetched.has(item.id) || item.volume >= minVolume),
      )
      .sort((a, b) => b.volume - a.volume)
      .slice(0, maxItems);
    const result = toFetch.length
      ? await fetchHistories(client, game, league, toFetch, today, log)
      : { points: [], pairs: [], fx: [], fetched: [] };
    if (!result) {
      log.warn(`${league.name}: history refresh postponed`);
    } else {
      fx = mergeFx(fx, result.fx);
      history = replaceItemSeries(history, result.points, toFetch);
      pairs = replaceItemSeries(pairs, result.pairs, toFetch);
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
        .filter((item) => item.id !== economy.unit && item.price > 0 && !withDetails.has(item.id))
        .map((item) => ({
          date: yesterday,
          item: item.id,
          price: item.price,
          volume: item.volume,
          source: 'snapshot',
        }));
      history = addSnapshotPoints(history, points, snapshot.items);
      if (!fx.some((p) => p.date === yesterday)) {
        fx = mergeFx(fx, [fxFromOverview(firstOverview, yesterday, economy.fxCurrencies)]);
      }
    }
    if (result) meta.lastClosedDate = yesterday;

    await store.writeHistory(league.id, history);
    await store.writeFx(league.id, fx);
    await store.writePairs(league.id, pairs);
    await store.writeMeta(league.id, meta);
  }

  for (const league of tracked) {
    await site.writeHistory(league, await store.readHistory(league.id));
    await site.writeFx(league, await store.readFx(league.id));
    const busiest = busiestByLeague.get(league.id);
    if (busiest) {
      const points = [...(await store.readPairs(league.id)).values()].flat();
      await site.writePairs({
        version: 1,
        leagueId: league.id,
        generatedAt: now.toISOString(),
        items: buildPairQuotes(points, busiest, now),
      });
    }
  }
  await site.copyIcons(store.root);
  await site.writeLeagues(tracked, now);
}

/** Units of the other core currencies per 1 unit, from an overview. */
function coreRates(overview: ExchangeOverview): CurrentFile['rates'] {
  const rates: CurrentFile['rates'] = {};
  for (const currency of CORE_CURRENCIES) {
    const rate = overview.core.rates[currency];
    if (rate) rates[currency] = rate;
  }
  return rates;
}

/** Leagues that are not trade leagues of the challenge (and so never tracked). */
const OTHER_LEAGUE = /^(HC |Hardcore|Ruthless|SSF|Standard)/;

/**
 * A started league whose name was unknown when it was added (`ninjaNameAuto`) takes
 * poe.ninja's current challenge league (first listed) when no tracked league has it.
 */
function resolveNinjaNames(
  tracked: readonly League[],
  listed: readonly string[],
  now: Date,
  log: Logger,
): League[] {
  const known = new Set(tracked.map((league) => league.ninjaName));
  const challenge = listed.find((id) => !OTHER_LEAGUE.test(id));
  return tracked.map((league) => {
    if (!league.ninjaNameAuto || !hasStarted(league, now) || listed.includes(league.ninjaName))
      return league;
    if (!challenge || known.has(challenge)) return league;
    log.warn(`${league.name}: using poe.ninja league "${challenge}": set its name in leagues.ts`);
    return { ...league, ninjaName: challenge };
  });
}

function checkLeagues(
  tracked: readonly League[],
  ninjaLeagues: Set<string>,
  now: Date,
  log: Logger,
) {
  for (const league of tracked) {
    const ended = league.endsAt !== null && Date.parse(league.endsAt) <= now.getTime();
    if (!ninjaLeagues.has(league.ninjaName) && !ended && hasStarted(league, now)) {
      log.warn(`League "${league.ninjaName}" not listed by poe.ninja: update leagues.ts`);
    }
  }
  const known = new Set(tracked.map((league) => league.ninjaName));
  for (const id of ninjaLeagues) {
    if (!known.has(id) && !OTHER_LEAGUE.test(id)) {
      log.warn(`poe.ninja lists unknown league "${id}": new league? update leagues.ts`);
    }
  }
}

async function fetchSnapshot(
  client: NinjaClient,
  game: Game,
  league: League,
): Promise<LeagueSnapshot> {
  const overviews: ExchangeOverview[] = [];
  const items = new Map<string, CurrentItem>();
  for (const type of EXCHANGE_TYPES[game]) {
    const overview = await fetchOverview(client, game, league.ninjaName, type);
    overviews.push(overview);
    for (const item of overviewToItems(overview, type)) {
      if (!items.has(item.id)) items.set(item.id, item);
    }
  }
  return { overviews, items: [...items.values()] };
}

async function fetchHistories(
  client: NinjaClient,
  game: Game,
  league: League,
  items: readonly CurrentItem[],
  today: string,
  log: Logger,
): Promise<{ points: DailyPoint[]; pairs: PairPoint[]; fx: FxPoint[]; fetched: string[] } | null> {
  const { unit, fxCurrencies } = ECONOMY[game];
  const unitDetails = await fetchDetails(
    client,
    game,
    league.ninjaName,
    'Currency',
    CURRENCY_DETAILS_ID[unit],
  );
  if (!unitDetails) {
    log.warn(`${league.name}: ${CURRENCY_NAMES[unit]} details not found`);
    return null;
  }
  const fx = fxFromUnitDetails(unitDetails, today, fxCurrencies);
  const fxByDate = new Map(fx.map((point) => [point.date, point]));

  const points: DailyPoint[] = [];
  const pairs: PairPoint[] = [];
  const fetched: string[] = [];
  for (const item of items) {
    let details;
    try {
      details = await fetchDetails(client, game, league.ninjaName, item.type, item.detailsId);
    } catch (error) {
      log.warn(`${league.name}: details failed for ${item.type}/${item.detailsId}: ${error}`);
      continue;
    }
    if (!details) {
      log.warn(`${league.name}: no details for ${item.type}/${item.detailsId}`);
      continue;
    }
    points.push(...detailsToDailyPoints(details, item.id, fxByDate, today, unit));
    pairs.push(...detailsToPairPoints(details, item.id, today));
    fetched.push(item.id);
  }
  return { points, pairs, fx, fetched };
}

/** Replaces the whole series of every item in `items` that has new points. */
function replaceItemSeries<P extends { item: string }>(
  history: Map<ExchangeType, P[]>,
  points: readonly P[],
  items: readonly CurrentItem[],
): Map<ExchangeType, P[]> {
  const replaced = new Set(points.map((p) => p.item));
  const typeOf = new Map(items.map((item) => [item.id, item.type]));
  const next = new Map(
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
