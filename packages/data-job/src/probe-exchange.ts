/**
 * M2a probe: captures GGG's public currency-exchange feed (hourly digests of every market)
 * so the flipping tool can be specified and tested against real payloads. Runs in GitHub
 * Actions (the feed is not reachable from the development sandbox) and writes to
 * `fixtures/ggg-exchange/probe/`.
 *
 * Captures the last few complete hours, keeping only the current league's markets (the raw
 * digest covers every league), plus a poe.ninja Currency overview taken at the same time
 * to cross-check ratio orientation against known prices.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LEAGUES } from '@poe-tools/shared';
import { createNinjaClient, type NinjaResponse } from './poe-ninja/client.ts';

const OUT_DIR = join(import.meta.dirname, '../../../fixtures/ggg-exchange/probe');
const EXCHANGE_URL = 'https://web.poecdn.com/api/currency-exchange/poe2';
const HOURS = 3;
const HOUR = 3600;

const [current = ''] = LEAGUES.filter((league) => league.game === 'poe2').map(
  (league) => league.ninjaName,
);

interface Market {
  league?: string;
  market_id?: string;
  market_pair?: string[];
  volume_traded?: Record<string, number>;
  lowest_ratio?: Record<string, number>;
  highest_ratio?: Record<string, number>;
  [key: string]: unknown;
}

interface Digest {
  next_change_id?: number;
  markets?: Market[];
  [key: string]: unknown;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

function traded(market: Market): boolean {
  return Object.values(market.volume_traded ?? {}).some((v) => v > 0);
}

function describe(res: NinjaResponse, epoch: number): string[] {
  const lines = [`## Hour ${new Date(epoch * 1000).toISOString()} (${epoch})`, ''];
  lines.push(`- URL: \`${res.url}\``, `- Status: ${res.status}, ${res.body.length} chars`);
  let digest: Digest;
  try {
    digest = JSON.parse(res.body) as Digest;
  } catch {
    return [...lines, '- Invalid JSON', ''];
  }
  const markets = digest.markets ?? [];
  const mine = markets.filter((m) => m.league === current);
  const keys = [...new Set(markets.flatMap((m) => Object.keys(m)))];
  lines.push(
    `- Top-level keys: ${Object.keys(digest).join(', ')}; next_change_id: ${digest.next_change_id}`,
    `- Market keys: ${keys.join(', ')}`,
    `- Markets: ${markets.length} total, ${mine.length} in ${current}, ${mine.filter(traded).length} with trades`,
    `- Markets per league: ${JSON.stringify(countBy(markets, (m) => m.league ?? '?'))}`,
  );
  const ids = countBy(
    mine.flatMap((m) => m.market_pair ?? []),
    (id) => id,
  );
  const top = Object.entries(ids)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, n]) => `${id} (${n})`);
  lines.push(`- Most connected base ids (likely hubs): ${top.join(', ')}`, '');
  return lines;
}

async function main() {
  const client = createNinjaClient();
  await mkdir(OUT_DIR, { recursive: true });
  const lines = ['# GGG currency-exchange probe', '', `Run at ${new Date().toISOString()}`, ''];

  // The newest digest is the last complete hour; take one more hour of margin for publication.
  const newest = Math.floor(Date.now() / 1000 / HOUR) * HOUR - 2 * HOUR;
  for (let i = 0; i < HOURS; i++) {
    const epoch = newest - i * HOUR;
    let res: NinjaResponse;
    try {
      res = await client.get(`${EXCHANGE_URL}/${epoch}`);
    } catch (error) {
      lines.push(`## Hour ${epoch}`, '', `request failed: ${error}`, '');
      continue;
    }
    console.log(`${res.status} ${res.url}`);
    lines.push(...describe(res, epoch));
    let body = res.body;
    try {
      const digest = JSON.parse(res.body) as Digest;
      digest.markets = (digest.markets ?? []).filter((m) => m.league === current);
      body = JSON.stringify(digest);
    } catch {
      // keep the raw body to see what came back
    }
    await writeFile(join(OUT_DIR, `exchange-${epoch}.json`), body);
  }

  const overview = await client.get(
    `/poe2/api/economy/exchange/current/overview?league=${encodeURIComponent(current)}&type=Currency`,
  );
  console.log(`${overview.status} ${overview.url}`);
  await writeFile(join(OUT_DIR, 'ninja-overview-currency.json'), overview.body);
  lines.push('## poe.ninja Currency overview (same run)', '', `- Status: ${overview.status}`, '');

  await appendFile(join(OUT_DIR, 'SUMMARY.md'), '\n' + lines.join('\n'));
}

await main();
