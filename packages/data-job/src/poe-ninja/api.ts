import type { ExchangeType } from '@poe-tools/shared';
import type { z } from 'zod';
import type { NinjaClient } from './client.ts';
import {
  exchangeDetailsSchema,
  exchangeOverviewSchema,
  ninjaLeaguesSchema,
  type ExchangeDetails,
  type ExchangeOverview,
} from './schemas.ts';

export class NinjaError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(`${message} (${url})`);
  }
}

const q = encodeURIComponent;

async function getJson<T>(client: NinjaClient, path: string, schema: z.ZodType<T>): Promise<T> {
  const json = await getJsonOrNull(client, path, schema, false);
  if (json === null) throw new NinjaError('Not found', path, 404);
  return json;
}

async function getJsonOrNull<T>(
  client: NinjaClient,
  path: string,
  schema: z.ZodType<T>,
  allowNotFound = true,
): Promise<T | null> {
  const res = await client.get(path);
  if (res.status === 404 && allowNotFound) return null;
  if (res.status !== 200) throw new NinjaError(`HTTP ${res.status}`, res.url, res.status);
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new NinjaError('Invalid JSON', res.url, res.status);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new NinjaError(`Unexpected response shape: ${parsed.error.message}`, res.url);
  }
  return parsed.data;
}

export async function fetchLeagues(client: NinjaClient) {
  return getJson(client, '/poe2/api/economy/leagues', ninjaLeaguesSchema);
}

export async function fetchOverview(
  client: NinjaClient,
  league: string,
  type: ExchangeType,
): Promise<ExchangeOverview> {
  const path = `/poe2/api/economy/exchange/current/overview?league=${q(league)}&type=${type}`;
  return getJson(client, path, exchangeOverviewSchema);
}

/** Full daily history of one item. Undocumented route: use sparingly. */
export async function fetchDetails(
  client: NinjaClient,
  league: string,
  type: ExchangeType,
  detailsId: string,
): Promise<ExchangeDetails | null> {
  const path = `/poe2/api/economy/exchange/current/details?league=${q(league)}&type=${type}&id=${q(detailsId)}`;
  return getJsonOrNull(client, path, exchangeDetailsSchema);
}
