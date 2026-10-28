import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentFileSchema,
  historyFileSchema,
  leaguesFileSchema,
  pairsFileSchema,
} from '@poe-tools/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNinjaClient } from './poe-ninja/client.ts';
import { runJob, type Logger } from './run.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';
import { poe1Fixture, probeFixture } from './test/fixtures.ts';

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
      iconFetch: async () =>
        new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
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
    const chaosPairs = (await store.readPairs('runes-of-aldur'))
      .get('Currency')
      ?.filter((p) => p.item === 'chaos');
    expect(new Set(chaosPairs?.map((p) => p.pair))).toEqual(new Set(['divine', 'exalted']));
    expect(chaosPairs?.every((p) => p.date < '2026-10-23')).toBe(true);

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
    // A few items have no image upstream; every other one points to a self-hosted icon.
    const withIcon = current.items.filter((i) => i.icon);
    expect(withIcon.length).toBeGreaterThan(current.items.length - 10);
    expect(withIcon.every((i) => i.icon.startsWith('icons/'))).toBe(true);
    expect((await readdir(join(root, 'site', 'icons'))).length).toBeGreaterThan(500);
    expect(current.rates.exalted).toBeGreaterThan(0);
    // Forbidden Rites has no daily pair rates yet: only the hourly busiest pair.
    const pairs = pairsFileSchema.parse(
      JSON.parse(await readFile(join(site, 'forbidden-rites', 'pairs.json'), 'utf8')),
    );
    expect(Object.keys(pairs.items).length).toBeGreaterThan(500);
    expect(pairs.items.chaos?.divine).toMatchObject({ source: 'hourly', volume: null });
    expect(await readdir(join(site, 'runes-of-aldur'))).not.toContain('pairs.json');
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

/** Serves the PoE 1 probe fixtures (Allflame) for every league but Mirage. */
function poe1Fetch(calls: string[], leagues: { id: string; name: string }[]): typeof fetch {
  const emptyOverview = JSON.stringify({
    ...(JSON.parse(poe1Fixture('overview-currency.json')) as object),
    lines: [],
    items: [],
  });
  return async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const league = url.searchParams.get('league');
    const type = url.searchParams.get('type')?.toLowerCase();
    const suffix = league === 'Mirage' ? '-mirage' : '';
    let body: string | null = null;
    if (url.pathname === '/poe1/api/economy/leagues') body = JSON.stringify(leagues);
    else if (url.pathname.endsWith('/overview')) {
      body = tryPoe1(`overview-${type}${suffix}.json`) ?? emptyOverview;
    } else if (url.pathname.endsWith('/details')) {
      const id = url.searchParams.get('id');
      body = tryPoe1(`details-${id}-${league === 'Mirage' ? 'mirage' : 'allflame'}.json`);
    }
    return body === null
      ? new Response('', { status: 404 })
      : new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

function tryPoe1(name: string): string | null {
  try {
    return poe1Fixture(name);
  } catch {
    return null;
  }
}

describe('runJob (PoE 1)', () => {
  let root: string;
  const warnings: string[] = [];
  const log: Logger = { info: () => {}, warn: (m) => warnings.push(m) };
  const LISTED = [
    { id: 'Allflame', name: 'Allflame' },
    { id: 'Hardcore Allflame', name: 'Hardcore Allflame' },
    { id: 'Standard', name: 'Standard' },
    { id: 'Hardcore', name: 'Hardcore' },
  ];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'poe-tools-job1-'));
    warnings.length = 0;
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  async function run(
    now: Date,
    calls: string[],
    listed = LISTED,
    wrap: (fetchImpl: typeof fetch) => typeof fetch = (f) => f,
  ) {
    await runJob({
      client: createNinjaClient({
        fetchImpl: wrap(poe1Fetch(calls, listed)),
        sleep: async () => {},
      }),
      store: createStore(join(root, 'store'), 'poe1'),
      site: createSiteWriter(join(root, 'site'), 'poe1'),
      now,
      log,
      iconFetch: async () =>
        new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    });
  }

  it('backfills the reference league in chaos before the next league starts', async () => {
    const calls: string[] = [];
    await run(new Date('2026-10-24T12:00:00Z'), calls);
    expect(calls.every((c) => c.startsWith('/poe1/'))).toBe(true);
    // The 3.30 league has not started: no request for it, no warning.
    expect(calls.some((c) => c.includes('3.30'))).toBe(false);
    expect(warnings.filter((w) => w.includes('3.30'))).toEqual([]);

    const store = createStore(join(root, 'store'), 'poe1');
    const meta = await store.readMeta('allflame');
    expect(meta.backfilledAt).not.toBeNull();
    const oil = (await store.readHistory('allflame'))
      .get('Oil')
      ?.filter((p) => p.item === 'golden-oil');
    expect(oil?.length).toBeGreaterThan(80);
    expect(oil?.at(-1)?.price).toBeGreaterThan(200);
    // The Divine Orb is an item in PoE 1, priced in chaos; chaos itself is the unit.
    const currency = (await store.readHistory('allflame')).get('Currency') ?? [];
    expect(currency.some((p) => p.item === 'divine' && p.price > 200)).toBe(true);
    expect(currency.some((p) => p.item === 'chaos')).toBe(false);
    expect((await store.readFx('allflame')).at(-1)?.rates.divine).toBeLessThan(0.01);

    // Mirage (ended, unlisted) is still fetched; its Chaos Orb details are not captured.
    expect(calls.some((c) => c.includes('league=Mirage'))).toBe(true);
    expect(warnings.some((w) => w.includes('Mirage: Chaos Orb details'))).toBe(true);

    const site = join(root, 'site', 'poe1');
    const history = historyFileSchema.parse(
      JSON.parse(await readFile(join(site, 'allflame', 'history', 'Oil.json'), 'utf8')),
    );
    expect(history.items['golden-oil']?.[0]?.[0]).toBe(1);
    const leagues = leaguesFileSchema.parse(
      JSON.parse(await readFile(join(site, 'leagues.json'), 'utf8')),
    );
    expect(leagues.leagues.map((l) => l.id)).toEqual(['poe1-3-30', 'allflame', 'mirage']);
    expect(await readdir(join(site, 'allflame'))).not.toContain('current.json');
    // Mirage is kept for backtests only: stored, not published.
    expect(await readdir(site)).not.toContain('mirage');
  });

  it('re-backfills a league once after its last day, keeping series it cannot refetch', async () => {
    await run(new Date('2026-10-24T12:00:00Z'), []);
    const store = createStore(join(root, 'store'), 'poe1');
    const oilOf = async () =>
      (await store.readHistory('allflame')).get('Oil')?.filter((p) => p.item === 'golden-oil');
    const oil = await oilOf();
    expect(oil?.length).toBeGreaterThan(80);

    // Ended, but its last UTC day is not over yet: no re-backfill.
    const sameDay: string[] = [];
    await run(new Date('2026-11-09T22:00:00Z'), sameDay);
    expect(sameDay.some((c) => c.includes('league=Allflame') && c.includes('/details'))).toBe(
      false,
    );

    // Next day: every item is refetched; one that fails keeps its stored series.
    const calls: string[] = [];
    await run(
      new Date('2026-11-10T00:30:00Z'),
      calls,
      LISTED,
      (f) => async (input, init) =>
        String(input).includes('id=golden-oil')
          ? new Response('', { status: 503 })
          : f(input, init),
    );
    expect(calls.some((c) => c.includes('league=Allflame') && c.includes('/details'))).toBe(true);
    expect(await oilOf()).toEqual(oil);
    expect((await store.readMeta('allflame')).detailsFetched).toContain('golden-oil');

    const later: string[] = [];
    await run(new Date('2026-11-10T13:00:00Z'), later);
    expect(later.some((c) => c.includes('league=Allflame'))).toBe(false);
  });

  it('keeps publishing the other leagues when one league fails', async () => {
    const calls: string[] = [];
    await expect(
      run(
        new Date('2026-10-24T12:00:00Z'),
        calls,
        LISTED,
        (f) => async (input, init) =>
          String(input).includes('league=Mirage')
            ? new Response('', { status: 500 })
            : f(input, init),
      ),
    ).rejects.toThrow('leagues not updated: Mirage');
    const store = createStore(join(root, 'store'), 'poe1');
    expect((await store.readMeta('allflame')).backfilledAt).not.toBeNull();
    expect(await readdir(join(root, 'site', 'poe1', 'allflame', 'history'))).toContain('Oil.json');
  });

  it('uses the new challenge league for the unnamed 3.30 entry once it started', async () => {
    const calls: string[] = [];
    await run(new Date('2026-11-14T12:00:00Z'), calls, [
      { id: 'Keepers', name: 'Keepers' },
      ...LISTED,
    ]);
    expect(calls.some((c) => c.includes('league=Keepers'))).toBe(true);
    expect(warnings.some((w) => w.includes('using poe.ninja league "Keepers"'))).toBe(true);
    const current = currentFileSchema.parse(
      JSON.parse(await readFile(join(root, 'site', 'poe1', 'poe1-3-30', 'current.json'), 'utf8')),
    );
    expect(current.unit).toBe('chaos');
    expect(current.rates.divine).toBeLessThan(0.01);
    expect(current.items.find((i) => i.id === 'divine')?.price).toBeGreaterThan(200);
  });
});
