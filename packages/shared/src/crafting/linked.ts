import type { Game } from '../games.ts';
import type { ExchangeType } from '../site-data.ts';

/*
 * Curated companions of crafting currencies (spec 08 §5, C9), Craft of Exile style:
 * picking the key item offers these alongside it. Exchange item ids per game; maintained
 * per league (ids missing from the exchange are skipped by the picker).
 */

const EXALTATION = [
  'omen-of-greater-exaltation',
  'omen-of-sinistral-exaltation',
  'omen-of-dextral-exaltation',
  'omen-of-catalysing-exaltation',
];
const ERASURE = ['omen-of-whittling', 'omen-of-sinistral-erasure', 'omen-of-dextral-erasure'];
const ANNULMENT = ['omen-of-sinistral-annulment', 'omen-of-dextral-annulment', 'omen-of-light'];
const CRYSTALLISATION = ['omen-of-sinistral-crystallisation', 'omen-of-dextral-crystallisation'];
const NECROMANCY = [
  'omen-of-sinistral-necromancy',
  'omen-of-dextral-necromancy',
  'omen-of-the-sovereign',
  'omen-of-the-liege',
  'omen-of-the-blackblooded',
  'omen-of-abyssal-echoes',
  'omen-of-putrefaction',
];

const LINKED: Record<string, readonly string[]> = {
  exalted: EXALTATION,
  'greater-exalted-orb': EXALTATION,
  'perfect-exalted-orb': EXALTATION,
  chaos: ERASURE,
  'greater-chaos-orb': ERASURE,
  'perfect-chaos-orb': ERASURE,
  annul: ANNULMENT,
  divine: ['omen-of-sanctification'],
  chance: ['omen-of-chance'],
};

/** PoE 1 (3.29): fossils go into a resonator; no crafting omens on the exchange. */
const RESONATORS = [
  'primitive-chaotic-resonator',
  'potent-chaotic-resonator',
  'powerful-chaotic-resonator',
  'prime-chaotic-resonator',
];

/** Exchange types whose items are used for crafting (picker categories, display order). */
export const CRAFTING_EXCHANGE_TYPES: Record<Game, readonly ExchangeType[]> = {
  poe2: [
    'Currency',
    'Ritual',
    'Essences',
    'Abyss',
    'Breach',
    'Runes',
    'SoulCores',
    'Idols',
    'Delirium',
    'Expedition',
    'Verisium',
  ],
  // PoE 1 catalysts and lifeforce are in Currency.
  poe1: ['Currency', 'Essence', 'Fossil', 'Resonator', 'Omen', 'Oil'],
};

/** Companion item ids offered with `itemId` (omens of a currency, of an essence, of a bone). */
export function linkedItems(game: Game, itemId: string): readonly string[] {
  if (game === 'poe1') return itemId.endsWith('-fossil') ? RESONATORS : [];
  const direct = LINKED[itemId];
  if (direct) return direct;
  if (itemId.startsWith('perfect-essence-')) return CRYSTALLISATION;
  if (/^(gnawed|preserved|ancient)-(rib|jawbone|collarbone|cranium)$/.test(itemId))
    return NECROMANCY;
  return [];
}
