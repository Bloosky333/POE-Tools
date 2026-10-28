import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  POE1_EXCHANGE_TYPES,
  POE2_EXCHANGE_TYPES,
  computeFlips,
  flipSettingsFor,
  flipsFileSchema,
  getTrackedLeagues,
} from '@poe-tools/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { overviewToItems } from '../convert.ts';
import { createNinjaClient } from '../poe-ninja/client.ts';
import { exchangeOverviewSchema } from '../poe-ninja/schemas.ts';
import type { Logger } from '../run.ts';
import { createSiteWriter } from '../site.ts';
import { exchangeFixture, poe1Fixture, probeFixture } from '../test/fixtures.ts';
import { exchangeDigestSchema } from './feed.ts';
import { HUB_BASE_IDS, buildItemMap, digestToHour } from './ingest.ts';
import { BASE_ITEMS_FILES, updateFlips } from './update.ts';
import { createWindowStore } from './window.ts';

const HOURS = [1792807200, 1792810800, 1792814400]; // 2026-10-24 02:00–04:00 UTC
const NEWEST = 1792814400;

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing test data');
  return value;
}

const league = must(getTrackedLeagues('poe2').find((l) => l.id === 'forbidden-rites'));

const items = POE2_EXCHANGE_TYPES.flatMap((type) => {
  try {
    const text = probeFixture(`exchange-overview-${type.toLowerCase()}-forbidden-rites.json`);
    return overviewToItems(exchangeOverviewSchema.parse(JSON.parse(text)), type);
  } catch {
    return [];
  }
});

const names = JSON.parse(
  await readFile(join(import.meta.dirname, '../../data/exchange-base-items.json'), 'utf8'),
) as Record<string, string>;

describe('digestToHour', () => {
  const digest = exchangeDigestSchema.parse(JSON.parse(must(exchangeFixture(NEWEST))));
  const { hour } = digestToHour(digest, NEWEST, league.ninjaName, buildItemMap(names, items));

  it('prices hub markets in the higher-ranked hub', () => {
    const chaos = hour.markets.find((m) => m.item === 'chaos' && m.hub === 'divine');
    expect(chaos).toMatchObject({ low: 1 / 10, high: 1 / 9 });
    const exalted = must(hour.markets.find((m) => m.item === 'exalted' && m.hub === 'divine'));
    expect(exalted.itemVolume / exalted.hubVolume).toBeCloseTo(697, 0);
  });

  it('prices items in hub units per item, matching poe.ninja', () => {
    const prism = must(hour.markets.find((m) => m.item === 'gcp' && m.hub === 'divine'));
    expect(prism.hubVolume / prism.itemVolume).toBeCloseTo(0.036, 3);
    expect(prism.low).toBeLessThan(prism.high);
  });

  it('maps every hub and most items', () => {
    const map = buildItemMap(names, items);
    for (const baseId of Object.keys(HUB_BASE_IDS)) expect(map.ids.has(baseId)).toBe(true);
    expect(map.ids.size).toBeGreaterThan(550);
  });
});

describe('updateFlips', () => {
  let root: string;
  const info: string[] = [];
  const warnings: string[] = [];
  const log: Logger = { info: (m) => info.push(m), warn: (m) => warnings.push(m) };
  const calls: number[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const epoch = Number(String(input).split('/').pop());
    calls.push(epoch);
    const body = exchangeFixture(epoch);
    return body === null ? new Response('', { status: 404 }) : new Response(body);
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'poe-tools-flips-'));
    calls.length = info.length = warnings.length = 0;
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  const run = (now: Date) =>
    updateFlips({
      client: createNinjaClient({ fetchImpl, sleep: async () => {} }),
      windows: createWindowStore(join(root, 'window')),
      site: createSiteWriter(join(root, 'site')),
      league,
      items,
      now,
      log,
    });

  it('builds the window, publishes flips, then only fetches missing hours', async () => {
    await run(new Date('2026-10-24T05:20:00Z'));
    expect(calls).toHaveLength(24);
    expect(calls[0]).toBe(NEWEST);
    expect(warnings).toEqual([]);

    const file = flipsFileSchema.parse(
      JSON.parse(await readFile(join(root, 'site/poe2/forbidden-rites/flips.json'), 'utf8')),
    );
    expect(file.hours).toEqual(HOURS);
    expect(file.flips.length).toBeGreaterThan(50);
    expect(file.flips.every((f) => f.margin > 0 && f.hourly.length === 3)).toBe(true);
    const prism = file.flips.find((f) => f.item === 'gcp' && f.kind === 'cross');
    expect(prism?.buy.hub).toBe('exalted');

    // Next hour: 04:00–05:00 is new, older missing hours are retried within the budget.
    calls.length = 0;
    await run(new Date('2026-10-24T06:20:00Z'));
    expect(calls).toHaveLength(4);
    expect(calls[0]).toBe(NEWEST + 3600);
  });

  it('rebuilds a truncated window and keeps the hours fetched before a failing one', async () => {
    await mkdir(join(root, 'window/poe2/forbidden-rites'), { recursive: true });
    await writeFile(join(root, 'window/poe2/forbidden-rites/exchange-window.json'), '{"vers');
    const failing = NEWEST - 3600;
    await updateFlips({
      client: createNinjaClient({
        fetchImpl: async (input, init) =>
          String(input).endsWith(`/${failing}`)
            ? new Response('', { status: 500 })
            : fetchImpl(input, init),
        sleep: async () => {},
      }),
      windows: createWindowStore(join(root, 'window')),
      site: createSiteWriter(join(root, 'site')),
      league,
      items,
      now: new Date('2026-10-24T05:20:00Z'),
      log,
    });
    expect(warnings.some((w) => w.includes('failed'))).toBe(true);
    const file = flipsFileSchema.parse(
      JSON.parse(await readFile(join(root, 'site/poe2/forbidden-rites/flips.json'), 'utf8')),
    );
    expect(file.hours).toEqual([HOURS[0], NEWEST]);
  });
});

const poe1Names = JSON.parse(await readFile(BASE_ITEMS_FILES.poe1, 'utf8')) as Record<
  string,
  string
>;

describe('PoE 1 feed (chaos and divine hubs)', () => {
  const poe1Items = POE1_EXCHANGE_TYPES.flatMap((type) => {
    try {
      const text = poe1Fixture(`overview-${type.toLowerCase()}.json`);
      return overviewToItems(exchangeOverviewSchema.parse(JSON.parse(text)), type);
    } catch {
      return [];
    }
  });
  const hours = [1792818000, 1792821600, 1792825200].map((epoch) => {
    const digest = exchangeDigestSchema.parse(JSON.parse(poe1Fixture(`exchange-${epoch}.json`)));
    const map = buildItemMap(poe1Names, poe1Items, {}, ['chaos', 'divine']);
    return digestToHour(digest, epoch, 'Allflame', map, ['chaos', 'divine']).hour;
  });

  it('prices markets against chaos or divine only', () => {
    const newest = must(hours.at(-1));
    expect(newest.markets.length).toBeGreaterThan(400);
    expect(new Set(newest.markets.map((m) => m.hub))).toEqual(new Set(['chaos', 'divine']));
    // Chaos ↔ divine market: chaos is the item side, ~330 chaos per divine.
    const chaos = must(newest.markets.find((m) => m.item === 'chaos' && m.hub === 'divine'));
    expect(chaos.itemVolume / chaos.hubVolume).toBeGreaterThan(250);
    expect(chaos.itemVolume / chaos.hubVolume).toBeLessThan(400);
  });

  it('computes flips with values in chaos', () => {
    const file = computeFlips('allflame', hours, new Date(), flipSettingsFor('poe1'));
    expect(file.flips.length).toBeGreaterThan(50);
    const cross = file.flips.filter((f) => f.kind === 'cross');
    expect(cross.length).toBeGreaterThan(0);
    for (const flip of cross) {
      expect(new Set([flip.buy.hub, flip.sell.hub])).toEqual(new Set(['chaos', 'divine']));
    }
    expect(file.flips.every((f) => f.value24h >= 2000)).toBe(true);
  });
});
