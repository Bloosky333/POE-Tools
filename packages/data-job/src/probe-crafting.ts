/**
 * Regenerates `packages/shared/data/crafting-{mods,bases}-poe2.json` for the
 * Crafting Recipes tool (spec 08 §4): the item prefixes / suffixes and equipment bases of
 * PoE 2, trimmed from the RePoE export. Run via the probe workflow (`source: crafting`)
 * after a patch.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CraftingBasesFile, CraftingModsFile } from '@poe-tools/shared';
import { z } from 'zod';
import { createNinjaClient } from './poe-ninja/client.ts';

const REPOE = 'https://repoe-fork.github.io/poe2';
export const CRAFTING_MODS_FILE = join(
  import.meta.dirname,
  '../../shared/data/crafting-mods-poe2.json',
);
export const CRAFTING_BASES_FILE = join(
  import.meta.dirname,
  '../../shared/data/crafting-bases-poe2.json',
);

/** Item classes that take random prefixes / suffixes. */
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

  const rawBases = baseItemsSchema.parse(await getJson(client, `${REPOE}/base_items.json`));
  const baseEntries = Object.entries(rawBases);
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

  const rawMods = modsSchema.parse(await getJson(client, `${REPOE}/mods.json`));
  const modEntries = Object.entries(rawMods);
  console.log('mod domains', count(modEntries.map(([, m]) => m.domain)));
  console.log('mod generation types', count(modEntries.map(([, m]) => m.generation_type)));
  console.log(
    'sample mod',
    JSON.stringify(
      modEntries.find(([, m]) => m.generation_type === 'prefix' && m.domain === 'item'),
    ),
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

  const modsFile: CraftingModsFile = { version: 1, generatedAt, source: REPOE, mods };
  const basesFile: CraftingBasesFile = { version: 1, generatedAt, source: REPOE, bases };
  await mkdir(dirname(CRAFTING_MODS_FILE), { recursive: true });
  await writeFile(CRAFTING_MODS_FILE, JSON.stringify(modsFile) + '\n');
  await writeFile(CRAFTING_BASES_FILE, JSON.stringify(basesFile) + '\n');
  console.log(`${mods.length} mods, ${bases.length} bases written`);
}

await main();
