import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentFileSchema, historyFileSchema, leaguesFileSchema } from '@poe-tools/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNinjaClient } from './poe-ninja/client.ts';
import { runJob, type Logger } from './run.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';
import { probeFixture } from './test/fixtures.ts';

/** Serves probe fixtures; unknown overviews are empty, unknown details are 404. */
function fakeFetch(calls: string[]): typeof fetch {
  const emptyOverview = JSON.stringify({
    ...(JSON.parse(probeFixture('exchange-overview-currency-runes-of-aldur.json')) as object),
    lines: [],
    items: [],
  });
  return async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const league = url.searchParams.get('league')?.toLowerCase().replaceAll(' ', '-');
    const type = url.searchParams.get('type')?.toLowerCase();
    let body: string | null = null;
    if (url.pathname === '/poe2/api/economy/leagues') body = probeFixture('poe2-leagues.json');
    else if (url.pathname.endsWith('/overview')) {
      body = tryFixture(`exchange-overview-${type}-${league}.json`) ?? emptyOverview;
    } else if (url.pathname.endsWith('/details')) {
      body = tryFixture(`exchange-details-${url.searchParams.get('id')}-${league}.json`);
    }
    return body === null
      ? new Response('', { status: 404 })
      : new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

function tryFixture(name: string): string | null {
  try {
    return probeFixture(name);
  } catch {
    return null;
  }
}

describe('runJob', () => {
  let root: string;
  const warnings: string[] = [];
  const log: Logger = { info: () => {}, warn: (m) => warnings.push(m) };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'poe-tools-job-'));
    warnings.length = 0;
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  async function run(now: Date, calls: string[]) {
    await runJob({
      client: createNinjaClient({ fetchImpl: fakeFetch(calls), sleep: async () => {} }),
      store: createStore(join(root, 'store')),
      site: createSiteWriter(join(root, 'site')),
      now,
      log,
    });
  }

  it('backfills, closes the day, publishes site files, then only refreshes current prices', async () => {
    const calls: string[] = [];
    await run(new Date('2026-10-23T23:30:00Z'), calls);

    // Backfill of Runes of Aldur fetched the chaos orb history.
    expect(calls.some((c) => c.includes('id=chaos-orb'))).toBe(true);
    const store = createStore(join(root, 'store'));
    const meta = await store.readMeta('runes-of-aldur');
    expect(meta.backfilledAt).not.toBeNull();
    expect(meta.lastClosedDate).toBe('2026-10-22');
    const history = await store.readHistory('runes-of-aldur');
    const chaos = history.get('Currency')?.filter((p) => p.item === 'chaos') ?? [];
    expect(chaos).toHaveLength(147);
    expect(chaos.every((p) => p.source === 'details')).toBe(true);

    // Forbidden Rites: no details fixtures → backfill postponed, yesterday closed from
    // the snapshot.
    expect((await store.readMeta('forbidden-rites')).backfilledAt).toBeNull();
    expect(warnings.some((w) => w.includes('Forbidden Rites: Divine Orb details'))).toBe(true);
    const fr = await store.readHistory('forbidden-rites');
    const frCurrency = fr.get('Currency') ?? [];
    expect(frCurrency.length).toBeGreaterThan(40);
    expect(frCurrency.every((p) => p.date === '2026-10-22' && p.source === 'snapshot')).toBe(true);

    // Site files.
    const site = join(root, 'site', 'poe2');
    const current = currentFileSchema.parse(
      JSON.parse(await readFile(join(site, 'forbidden-rites', 'current.json'), 'utf8')),
    );
    expect(current.items.length).toBeGreaterThan(500);
    expect(current.rates.exalted).toBeGreaterThan(0);
    const roaHistory = historyFileSchema.parse(
      JSON.parse(await readFile(join(site, 'runes-of-aldur', 'history', 'Currency.json'), 'utf8')),
    );
    expect(roaHistory.items.chaos?.[0]?.[0]).toBe(0);
    expect(roaHistory.items.chaos?.at(-1)?.[0]).toBe(146);
    const leagues = leaguesFileSchema.parse(
      JSON.parse(await readFile(join(site, 'leagues.json'), 'utf8')),
    );
    expect(leagues.leagues.map((l) => l.id)).toEqual(['forbidden-rites', 'runes-of-aldur']);
    expect(await readdir(join(site, 'forbidden-rites', 'history'))).toContain('Currency.json');

    // Next hour, same day: only current overviews of the selectable league.
    const nextCalls: string[] = [];
    await run(new Date('2026-10-23T23:59:00Z'), nextCalls);
    // (Forbidden Rites retries its postponed backfill: one Divine Orb request.)
    expect(nextCalls.filter((c) => c.includes('/details'))).toEqual([
      '/poe2/api/economy/exchange/current/details?league=Forbidden%20Rites&type=Currency&id=divine-orb',
    ]);
    expect(nextCalls.filter((c) => c.includes('Runes%20of%20Aldur'))).toEqual([]);
  });
});
