/**
 * M0 probe: captures real poe.ninja responses so the data job and its tests can be
 * written against actual payloads. Runs in GitHub Actions (poe.ninja is not reachable
 * from the development sandbox) and writes to `fixtures/poe-ninja/probe/`.
 *
 * Kept deliberately small (~20 throttled requests, run on demand only).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LEAGUES } from '@poe-tools/shared';
import { createNinjaClient, type NinjaResponse } from './poe-ninja/client.ts';

const OUT_DIR = join(import.meta.dirname, '../../../fixtures/poe-ninja/probe');
const MAX_BODY_CHARS = 400_000;

const leagues = LEAGUES.filter((league) => league.game === 'poe2').map((l) => l.ninjaName);
const q = encodeURIComponent;

/** Candidate endpoints: official docs + community-reported PoE 2 economy paths. */
const targets: { name: string; path: string }[] = [
  { name: 'docs-api', path: '/docs/api' },
  { name: 'poe2-leagues', path: '/poe2/api/economy/leagues' },
  { name: 'poe1-leagues', path: '/poe1/api/economy/leagues' },
  { name: 'poe2-data-dumps', path: '/poe2/data' },
  { name: 'data-dumps', path: '/data' },
  ...leagues.flatMap((league) => [
    {
      name: `exchange-overview-currency-${league}`,
      path: `/poe2/api/economy/exchange/current/overview?league=${q(league)}&type=Currency`,
    },
    {
      name: `currencyexchange-overview-currency-${league}`,
      path: `/poe2/api/economy/currencyexchange/overview?leagueName=${q(league)}&overviewName=Currency`,
    },
  ]),
  {
    name: `exchange-details-divine-${leagues[0]}`,
    path: `/poe2/api/economy/exchange/current/details?league=${q(leagues[0] ?? '')}&type=Currency&id=divine`,
  },
];

function summarize(res: NinjaResponse): string {
  if (!res.contentType?.includes('json')) return `${res.body.length} chars (non-JSON)`;
  try {
    return describeShape(JSON.parse(res.body), 0);
  } catch {
    return 'invalid JSON';
  }
}

function describeShape(value: unknown, depth: number): string {
  if (Array.isArray(value)) {
    return `array(${value.length})${value.length ? ` of ${describeShape(value[0], depth + 1)}` : ''}`;
  }
  if (value && typeof value === 'object') {
    if (depth > 2) return 'object';
    const entries = Object.entries(value).slice(0, 25);
    return `{ ${entries.map(([k, v]) => `${k}: ${describeShape(v, depth + 1)}`).join(', ')} }`;
  }
  return typeof value;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function main() {
  const client = createNinjaClient();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const lines = ['# poe.ninja probe', '', `Run at ${new Date().toISOString()}`, ''];
  for (const target of targets) {
    let res: NinjaResponse;
    try {
      res = await client.get(target.path);
    } catch (error) {
      lines.push(`## ${target.name}`, '', `\`${target.path}\` → request failed: ${error}`, '');
      continue;
    }
    const ext = res.contentType?.includes('json') ? 'json' : 'txt';
    const truncated = res.body.length > MAX_BODY_CHARS;
    await writeFile(
      join(OUT_DIR, `${slug(target.name)}.${ext}`),
      truncated ? res.body.slice(0, MAX_BODY_CHARS) : res.body,
    );
    lines.push(
      `## ${target.name}`,
      '',
      `- URL: \`${res.url}\``,
      `- Status: ${res.status}, content-type: ${res.contentType ?? 'n/a'}${truncated ? ' (truncated)' : ''}`,
      `- Shape: ${summarize(res)}`,
      '',
    );
    console.log(`${res.status} ${target.path}`);
  }
  await writeFile(join(OUT_DIR, 'SUMMARY.md'), lines.join('\n'));
}

await main();
