/**
 * GGG's public currency-exchange feed: one digest per complete UTC hour, every market of
 * every league of a game (see `docs/specs/05-ggg-exchange-api.md`).
 */
import type { Game } from '@poe-tools/shared';
import { z } from 'zod';
import type { NinjaClient } from '../poe-ninja/client.ts';

/** Feed of each game (PoE 1 has no realm segment; verified by the probe, 2026-10-24). */
export const EXCHANGE_FEED_URLS: Record<Game, string> = {
  poe2: 'https://web.poecdn.com/api/currency-exchange/poe2',
  poe1: 'https://web.poecdn.com/api/currency-exchange',
};

export const HOUR_S = 3600;

const quantities = z.record(z.string(), z.number());

export const exchangeDigestSchema = z.object({
  next_change_id: z.number(),
  markets: z.array(
    z.object({
      league: z.string(),
      market_pair: z.tuple([z.string(), z.string()]),
      volume_traded: quantities,
      lowest_stock: quantities,
      highest_stock: quantities,
      lowest_ratio: quantities,
      highest_ratio: quantities,
    }),
  ),
});
export type ExchangeDigest = z.infer<typeof exchangeDigestSchema>;
export type ExchangeMarket = ExchangeDigest['markets'][number];

/** Start of the newest hour whose digest should be published (~5 min after it closes). */
export function newestCompleteHour(now: Date): number {
  return Math.floor((now.getTime() / 1000 - 10 * 60) / HOUR_S) * HOUR_S - HOUR_S;
}

/** The digest of the hour starting at `epoch`, or null when it is not available. */
export async function fetchDigest(
  client: NinjaClient,
  epoch: number,
  game: Game = 'poe2',
): Promise<ExchangeDigest | null> {
  const res = await client.get(`${EXCHANGE_FEED_URLS[game]}/${epoch}`);
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`HTTP ${res.status} (${res.url})`);
  const digest = exchangeDigestSchema.parse(JSON.parse(res.body));
  // A digest for another hour (e.g. the newest available one) is not the one asked for.
  return digest.next_change_id === epoch + HOUR_S ? digest : null;
}
