/**
 * Regenerates `packages/shared/data/crafting-{mods,bases}-<game>.json` for the
 * Crafting Recipes tool (spec 08 §4): the item prefixes / suffixes and equipment bases of
 * the game (`GAME` env, default poe2), trimmed from the RePoE export. Run via the probe
 * workflow (`source: crafting`, `game`) after a patch.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { GAMES, type CraftingBasesFile, type CraftingModsFile, type Game } from '@poe-tools/shared';
import { z } from 'zod';
import { createNinjaClient } from './poe-ninja/client.ts';

const game: Game = GAMES.find((g) => g === process.env.GAME) ?? 'poe2';
const REPOE: Record<Game, string> = {
  poe2: 'https://repoe-fork.github.io/poe2',
  poe1: 'https://repoe-fork.github.io',
};
export const craftingDataFile = (kind: 'mods' | 'bases', g: Game) =>
  join(import.meta.dirname, `../../shared/data/crafting-${kind}-${g}.json`);

/** Item classes that take random prefixes / suffixes (RePoE `item_class`, both games). */
const CRAFTABLE_CLASSES = new Set([
  'Amulet',
  'Ring',
  'Belt',
  'Body Armour',
  'Boots',
  'Gloves',
  'Helmet',
  'Shield',
  'Focus',
  'Buckler',
  'Quiver',
  'Bow',
  'Crossbow',
  'Wand',
  'Staff',
  'Warstaff',
  'Sceptre',
  'Claw',
  'Dagger',
  'Flail',
  'Spear',
  'One Hand Mace',
  'Two Hand Mace',
  'One Hand Sword',
  'Two Hand Sword',
  'One Hand Axe',
  'Two Hand Axe',
  'Talisman',
  'Jewel',
  'Charm',
  'Life Flask',
  'Mana Flask',
  // PoE 1 only
  'Rune Dagger',
  'Thrusting One Hand Sword',
  'AbyssJewel',
  'LifeFlask',
  'ManaFlask',
  'HybridFlask',
  'UtilityFlask',
]);

const modsSchema = z.record(
  z.string(),
  z
    .object({
      name: z.string().optional(),
      type: z.string().optional(),
      domain: z.string().optional(),
      generation_type: z.string().optional(),
      required_level: z.number().optional(),
      text: z.string().nullish(),
      is_essence_only: z.boolean().optional(),
      spawn_weights: z.array(z.object({ tag: z.string(), weight: z.number() })).optional(),
    })
    .loose(),
);

const baseItemsSchema = z.record(
  z.string(),
  z
    .object({
      name: z.string().optional(),
      item_class: z.string().optional(),
      domain: z.string().optional(),
      release_state: z.string().optional(),
      drop_level: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })
    .loose(),
);

function count(values: (string | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v ?? '-'] = (out[v ?? '-'] ?? 0) + 1;
  return out;
}

async function getJson(client: ReturnType<typeof createNinjaClient>, url: string) {
  const res = await client.get(url);
  console.log(`${res.status} ${res.url}`);
  if (res.status !== 200) throw new Error(`RePoE: HTTP ${res.status}`);
  return JSON.parse(res.body) as unknown;
}

async function main() {
  const client = createNinjaClient();
  const generatedAt = new Date().toISOString();
  const source = REPOE[game];
  console.log(`game ${game}, source ${source}`);

  const rawBases = baseItemsSchema.parse(await getJson(client, `${source}/base_items.json`));
  const baseEntries = Object.entries(rawBases);
  console.log('base item classes', count(baseEntries.map(([, b]) => b.item_class)));
  console.log('base domains', count(baseEntries.map(([, b]) => b.domain)));
  console.log('base release states', count(baseEntries.map(([, b]) => b.release_state)));
  console.log(
    'sample base',
    JSON.stringify(baseEntries.find(([, b]) => b.item_class === 'Body Armour')),
  );
  const bases: CraftingBasesFile['bases'] = [];
  for (const [id, b] of baseEntries) {
    if (!b.name || !b.item_class || !CRAFTABLE_CLASSES.has(b.item_class)) continue;
    if (b.release_state && b.release_state !== 'released') continue;
    bases.push({
      id,
      name: b.name,
      itemClass: b.item_class,
      level: b.drop_level ?? 1,
      tags: b.tags ?? [],
    });
  }
  bases.sort((a, b) => a.itemClass.localeCompare(b.itemClass) || a.level - b.level);

  const rawMods = modsSchema.parse(await getJson(client, `${source}/mods.json`));
  const modEntries = Object.entries(rawMods);
  console.log('mod domains', count(modEntries.map(([, m]) => m.domain)));
  console.log('mod generation types', count(modEntries.map(([, m]) => m.generation_type)));
  console.log(
    'sample mod',
    JSON.stringify(
      modEntries.find(([, m]) => m.generation_type === 'prefix' && m.domain === 'item'),
    ),
  );
  console.log(
    'item affixes without text',
    modEntries.filter(
      ([, m]) =>
        m.domain === 'item' &&
        (m.generation_type === 'prefix' || m.generation_type === 'suffix') &&
        !m.text,
    ).length,
  );
  const mods: CraftingModsFile['mods'] = [];
  for (const [id, m] of modEntries) {
    if (m.domain !== 'item') continue;
    if (m.generation_type !== 'prefix' && m.generation_type !== 'suffix') continue;
    if (!m.type || !m.text) continue;
    const weights = (m.spawn_weights ?? []).map((w) => [w.tag, w.weight] as [string, number]);
    if (!m.is_essence_only && !weights.some(([, w]) => w > 0)) continue;
    mods.push({
      id,
      name: m.name ?? '',
      family: m.type,
      kind: m.generation_type,
      level: m.required_level ?? 1,
      text: m.text,
      weights,
      ...(m.is_essence_only ? { essenceOnly: true } : {}),
    });
  }
  mods.sort((a, b) => a.family.localeCompare(b.family) || a.level - b.level);

  if (!mods.length || !bases.length) throw new Error('RePoE: no mod or no base kept');

  const modsFile: CraftingModsFile = { version: 1, generatedAt, source, mods };
  const basesFile: CraftingBasesFile = { version: 1, generatedAt, source, bases };
  await mkdir(dirname(craftingDataFile('mods', game)), { recursive: true });
  await writeFile(craftingDataFile('mods', game), JSON.stringify(modsFile) + '\n');
  await writeFile(craftingDataFile('bases', game), JSON.stringify(basesFile) + '\n');
  console.log(`${mods.length} mods, ${bases.length} bases written`);
}

await main();
