/*
 * Curated companions of crafting currencies (spec 08 §5, C9), Craft of Exile style:
 * picking the key item offers these alongside it. Exchange item ids of PoE 2; maintained
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

/** Exchange types whose items are used for crafting (picker categories, display order). */
export const CRAFTING_EXCHANGE_TYPES = [
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
] as const;

/** Companion item ids offered with `itemId` (omens of a currency, of an essence, of a bone). */
export function linkedItems(itemId: string): readonly string[] {
  const direct = LINKED[itemId];
  if (direct) return direct;
  if (itemId.startsWith('perfect-essence-')) return CRYSTALLISATION;
  if (/^(gnawed|preserved|ancient)-(rib|jawbone|collarbone|cranium)$/.test(itemId))
    return NECROMANCY;
  return [];
}
