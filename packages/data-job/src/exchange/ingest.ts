import {
  marketSides,
  type CurrentItem,
  type ExchangeHour,
  type Hub,
  type MarketHour,
} from '@poe-tools/shared';
import type { ExchangeDigest } from './feed.ts';

/** Base item ids of the hub currencies in the feed (verified by the probe, 2026-10-24). */
export const HUB_BASE_IDS: Record<string, Hub> = {
  'Metadata/Items/Currency/CurrencyModValues': 'divine',
  'Metadata/Items/Currency/CurrencyAddModToRare': 'exalted',
  'Metadata/Items/Currency/CurrencyRerollRare': 'chaos',
};

export interface ItemMap {
  /** Feed base item id → poe.ninja item id. */
  ids: Map<string, string>;
  /** Base ids with a name that matches no poe.ninja item. */
  unmatched: string[];
}

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Maps feed base ids to poe.ninja items by name (`names`: base id → RePoE name,
 * `aliases`: base id → poe.ninja id for names that differ or are ambiguous).
 */
export function buildItemMap(
  names: Readonly<Record<string, string>>,
  items: readonly CurrentItem[],
  aliases: Readonly<Record<string, string>> = {},
): ItemMap {
  const byName = new Map<string, string[]>();
  for (const item of items) {
    const list = byName.get(normalize(item.name)) ?? [];
    list.push(item.id);
    byName.set(normalize(item.name), list);
  }
  const ids = new Map<string, string>();
  const unmatched: string[] = [];
  for (const [baseId, name] of Object.entries(names)) {
    const hub = HUB_BASE_IDS[baseId];
    const alias = aliases[baseId];
    const matches = byName.get(normalize(name)) ?? [];
    if (hub) ids.set(baseId, hub);
    else if (alias) ids.set(baseId, alias);
    else if (matches.length === 1 && matches[0]) ids.set(baseId, matches[0]);
    else unmatched.push(baseId);
  }
  return { ids, unmatched };
}

/**
 * The traded markets of one league between an item and a hub currency (or two hubs),
 * with prices in hub units per 1 item. `unknown`: base ids missing from the item map.
 */
export function digestToHour(
  digest: ExchangeDigest,
  epoch: number,
  league: string,
  map: ItemMap,
): { hour: ExchangeHour; unknown: Set<string> } {
  const markets: MarketHour[] = [];
  const unknown = new Set<string>();
  for (const m of digest.markets) {
    if (m.league !== league) continue;
    const [a, b] = m.market_pair;
    const hubA = HUB_BASE_IDS[a];
    const hubB = HUB_BASE_IDS[b];
    let itemBase: string;
    let hubBase: string;
    if (hubA && hubB) {
      const sides = marketSides(hubA, hubB);
      [itemBase, hubBase] = sides.item === hubA ? [a, b] : [b, a];
    } else if (hubA || hubB) {
      [itemBase, hubBase] = hubA ? [b, a] : [a, b];
    } else {
      continue;
    }
    const item = map.ids.get(itemBase);
    const hub = HUB_BASE_IDS[hubBase];
    if (!item || !hub) {
      unknown.add(itemBase);
      continue;
    }
    const itemVolume = m.volume_traded[itemBase] ?? 0;
    const hubVolume = m.volume_traded[hubBase] ?? 0;
    const price = (ratio: Record<string, number>) => {
      const quantity = ratio[itemBase] ?? 0;
      return quantity > 0 ? (ratio[hubBase] ?? 0) / quantity : 0;
    };
    const low = price(m.lowest_ratio);
    const high = price(m.highest_ratio);
    if (itemVolume <= 0 || hubVolume <= 0 || low <= 0 || high <= 0) continue;
    markets.push({
      item,
      hub,
      itemVolume,
      hubVolume,
      low: Math.min(low, high),
      high: Math.max(low, high),
    });
  }
  return { hour: { epoch, markets }, unknown };
}
