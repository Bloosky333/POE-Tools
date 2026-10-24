/**
 * PoE 1 probe (spec 07 §8, P0): captures what the PoE 1 port depends on, in one run.
 * Runs in GitHub Actions (poe.ninja / GGG are not reachable from the development sandbox)
 * and writes to `fixtures/poe1/`:
 *
 * - poe.ninja PoE 1 leagues, every exchange overview of the current league, item details
 *   (current league and the ended previous league), the data dumps page;
 * - GGG currency-exchange feed candidates for PoE 1 (the PoE 2 route is `.../poe2/{hour}`);
 *   if one answers, the last 24 hours of base ids and their RePoE PoE 1 names
 *   (`packages/data-job/data/exchange-base-items-poe1.json`).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { createNinjaClient, type NinjaResponse } from './poe-ninja/client.ts';

const OUT_DIR = join(import.meta.dirname, '../../../fixtures/poe1');
const NAMES_FILE = join(import.meta.dirname, '../data/exchange-base-items-poe1.json');
const HOUR = 3600;
const FEED_HOURS = 24;
const FEED_KEPT = 3;
const PREVIOUS_LEAGUE = 'Mirage';
const REPOE_URL = 'https://repoe-fork.github.io/base_items.json';
const FEED_CANDIDATES = [
  'https://web.poecdn.com/api/currency-exchange',
  'https://web.poecdn.com/api/currency-exchange/pc',
  'https://web.poecdn.com/api/currency-exchange/poe1',
];
const TYPES = [
  'Currency',
  'Fragment',
  'Runegraft',
  'AllflameEmber',
  'Tattoo',
  'Omen',
  'DjinnCoin',
  'Ducat',
  'EnshroudingCrystal',
  'DivinationCard',
  'Artifact',
  'Oil',
  'DeliriumOrb',
  'Scarab',
  'Astrolabe',
  'Fossil',
  'Resonator',
  'Essence',
];

const q = encodeURIComponent;
const client = createNinjaClient();
const summary = ['# PoE 1 probe', '', `Run at ${new Date().toISOString()}`, ''];

const overviewSchema = z
  .object({
    core: z.object({ primary: z.string(), rates: z.record(z.string(), z.number()) }).loose(),
    lines: z.array(
      z
        .object({ id: z.string(), primaryValue: z.number(), volumePrimaryValue: z.number() })
        .loose(),
    ),
    items: z.array(z.object({ id: z.string(), name: z.string(), detailsId: z.string() }).loose()),
  })
  .loose();
const digestSchema = z.object({
  next_change_id: z.number(),
  markets: z.array(
    z
      .object({
        league: z.string(),
        market_pair: z.array(z.string()),
        volume_traded: z.record(z.string(), z.number()),
      })
      .loose(),
  ),
});

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function get(path: string): Promise<NinjaResponse | null> {
  try {
    const res = await client.get(path);
    console.log(`${res.status} ${res.url}`);
    return res;
  } catch (error) {
    summary.push(`- \`${path}\` → request failed: ${error}`);
    return null;
  }
}

async function save(name: string, res: NinjaResponse) {
  await writeFile(join(OUT_DIR, name), res.body);
}

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

async function probeNinja(): Promise<string> {
  summary.push('## poe.ninja', '');
  const leaguesRes = await get('/poe1/api/economy/leagues');
  let current = 'Curse of the Allflame';
  if (leaguesRes) {
    await save('leagues.json', leaguesRes);
    summary.push(`- Leagues (${leaguesRes.status}): \`${leaguesRes.body.slice(0, 600)}\``);
    try {
      const leagues = JSON.parse(leaguesRes.body) as { id: string; name: string }[];
      current = leagues[0]?.id ?? current;
    } catch {
      // keep the default
    }
  }
  summary.push(`- Current league used: \`${current}\``, '');

  summary.push(
    '| Type | Status | primary | rates | items | ≥300 c/d | ≥1000 c/d | median price | top item |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  const samples: { type: string; detailsId: string; name: string }[] = [];
  for (const type of TYPES) {
    const res = await get(
      `/poe1/api/economy/exchange/current/overview?league=${q(current)}&type=${type}`,
    );
    if (!res) continue;
    if (res.status !== 200) {
      summary.push(`| ${type} | ${res.status} | | | | | | | |`);
      continue;
    }
    await save(`overview-${slug(type)}.json`, res);
    const parsed = overviewSchema.safeParse(JSON.parse(res.body));
    if (!parsed.success) {
      summary.push(`| ${type} | 200, unexpected shape: ${parsed.error.message.slice(0, 200)} |`);
      continue;
    }
    const { core, lines, items } = parsed.data;
    const byVolume = [...lines].sort((a, b) => b.volumePrimaryValue - a.volumePrimaryValue);
    const top = byVolume[0];
    const topItem = items.find((item) => item.id === top?.id);
    summary.push(
      `| ${type} | 200 | ${core.primary} | ${JSON.stringify(core.rates)} | ${lines.length} | ` +
        `${lines.filter((l) => l.volumePrimaryValue >= 300).length} | ` +
        `${lines.filter((l) => l.volumePrimaryValue >= 1000).length} | ` +
        `${quantile(
          lines.map((l) => l.primaryValue),
          0.5,
        ).toPrecision(
          3,
        )} | ${topItem?.name ?? '?'} (${top?.primaryValue}, vol ${top?.volumePrimaryValue}) |`,
    );
    const picks = type === 'Currency' ? byVolume.slice(0, 3) : byVolume.slice(0, 1);
    for (const line of picks) {
      const item = items.find((i) => i.id === line.id);
      if (item) samples.push({ type, detailsId: item.detailsId, name: item.name });
    }
  }
  summary.push('');

  summary.push('### Details route', '');
  const detailTargets = [
    ...samples.map((s) => ({ ...s, league: current })),
    { type: 'Currency', detailsId: 'divine-orb', name: 'Divine Orb', league: current },
    { type: 'Currency', detailsId: 'chaos-orb', name: 'Chaos Orb', league: current },
    { type: 'Currency', detailsId: 'divine-orb', name: 'Divine Orb', league: PREVIOUS_LEAGUE },
  ];
  for (const t of detailTargets) {
    const res = await get(
      `/poe1/api/economy/exchange/current/details?league=${q(t.league)}&type=${t.type}&id=${q(t.detailsId)}`,
    );
    if (!res) continue;
    let shape = res.body.slice(0, 200);
    if (res.status === 200) {
      await save(`details-${slug(t.detailsId)}-${slug(t.league)}.json`, res);
      try {
        const json = JSON.parse(res.body) as {
          pairs?: { id: string; history?: { timestamp: string }[] }[];
        };
        shape = (json.pairs ?? [])
          .map((p) => {
            const h = p.history ?? [];
            return `${p.id}: ${h.length} pts (${h.at(-1)?.timestamp ?? '?'} → ${h[0]?.timestamp ?? '?'})`;
          })
          .join('; ');
      } catch {
        shape = 'invalid JSON';
      }
    }
    summary.push(
      `- ${t.name} / ${t.league} (${t.type}, \`${t.detailsId}\`): ${res.status} — ${shape}`,
    );
  }
  summary.push('');

  const prevOverview = await get(
    `/poe1/api/economy/exchange/current/overview?league=${q(PREVIOUS_LEAGUE)}&type=Currency`,
  );
  if (prevOverview) {
    summary.push(
      `- Overview of the ended league ${PREVIOUS_LEAGUE}: ${prevOverview.status}, ${prevOverview.body.length} chars`,
    );
    if (prevOverview.status === 200)
      await save(`overview-currency-${slug(PREVIOUS_LEAGUE)}.json`, prevOverview);
  }
  const dumps = await get('/poe1/data');
  if (dumps) {
    await writeFile(join(OUT_DIR, 'data-dumps.html'), dumps.body);
    const links = [...dumps.body.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h): h is string => !!h && /dump|zip|csv|data/i.test(h));
    summary.push(
      `- Data dumps page: ${dumps.status}; links: ${[...new Set(links)].slice(0, 40).join(', ')}`,
    );
  }
  summary.push('');
  return current;
}

async function probeFeed(current: string) {
  summary.push('## GGG currency-exchange feed', '');
  const newest = Math.floor(Date.now() / 1000 / HOUR) * HOUR - 2 * HOUR;
  let working: string | null = null;
  for (const base of FEED_CANDIDATES) {
    const res = await get(`${base}/${newest}`);
    if (!res) continue;
    let detail = res.body.slice(0, 200).replace(/\s+/g, ' ');
    if (res.status === 200) {
      const parsed = digestSchema.safeParse(JSON.parse(res.body));
      if (parsed.success) {
        const leagues: Record<string, number> = {};
        for (const m of parsed.data.markets) leagues[m.league] = (leagues[m.league] ?? 0) + 1;
        detail = `next_change_id ${parsed.data.next_change_id}, ${parsed.data.markets.length} markets, leagues ${JSON.stringify(leagues).slice(0, 600)}`;
        if (!working && Object.keys(leagues).some((l) => l === current)) working = base;
      } else {
        detail = `unexpected shape: ${parsed.error.message.slice(0, 200)}`;
      }
    }
    summary.push(`- \`${base}/{hour}\`: ${res.status} — ${detail}`);
  }
  summary.push(`- Working PoE 1 feed: ${working ? `\`${working}\`` : 'none'}`, '');
  if (!working) return;

  const ids = new Set<string>();
  const hubs: Record<string, number> = {};
  for (let i = 0; i < FEED_HOURS; i++) {
    const epoch = newest - i * HOUR;
    const res = await get(`${working}/${epoch}`);
    if (!res || res.status !== 200) continue;
    const digest = digestSchema.parse(JSON.parse(res.body));
    const mine = digest.markets.filter((m) => m.league === current);
    for (const m of mine) for (const id of m.market_pair) ids.add(id);
    if (i < FEED_KEPT) {
      await writeFile(
        join(OUT_DIR, `exchange-${epoch}.json`),
        JSON.stringify({ ...digest, markets: mine }),
      );
      const traded = mine.filter((m) => Object.values(m.volume_traded).some((v) => v > 0));
      for (const m of mine) for (const id of m.market_pair) hubs[id] = (hubs[id] ?? 0) + 1;
      summary.push(
        `- Hour ${epoch}: ${mine.length} markets in ${current}, ${traded.length} traded`,
      );
    }
  }
  const top = Object.entries(hubs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n]) => `${id} (${n})`);
  summary.push(`- Markets per base id over the kept hours (hubs first): ${top.join(', ')}`, '');

  const res = await get(REPOE_URL);
  if (!res || res.status !== 200) {
    summary.push(`- RePoE PoE 1 base items: ${res?.status ?? 'failed'}`);
    return;
  }
  const baseItems = z
    .record(z.string(), z.object({ name: z.string().optional() }).loose())
    .parse(JSON.parse(res.body));
  const names: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of [...ids].sort()) {
    const name = baseItems[id]?.name;
    if (name) names[id] = name;
    else missing.push(id);
  }
  await mkdir(dirname(NAMES_FILE), { recursive: true });
  await writeFile(NAMES_FILE, JSON.stringify(names, null, 2) + '\n');
  summary.push(
    `- RePoE names: ${Object.keys(names).length} of ${ids.size} ids; without name: ${missing.slice(0, 30).join(', ')}`,
  );
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const current = await probeNinja();
  await probeFeed(current);
  await writeFile(join(OUT_DIR, 'SUMMARY.md'), summary.join('\n') + '\n');
}

await main();
