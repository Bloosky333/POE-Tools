import type { Game } from '../games.ts';
import { EXCHANGE_TYPE_LABELS, type CurrentItem, type ExchangeType } from '../site-data.ts';

/*
 * Which league mechanic an exchange item is farmed from (spec 09 §2). Hand-kept per game and
 * reviewed every league: a default per category plus item-name overrides for mixed categories.
 * A category missing here (e.g. a new league's) becomes its own row, named after the category.
 */

/** What an item counts as: loot of a mechanic, general loot, or not farmed loot at all. */
export type FarmRole =
  | { kind: 'mechanic'; mechanic: string }
  /** Drops everywhere: the greyed baseline row. */
  | { kind: 'any' }
  /** Bought to run content (scarabs…): excluded. */
  | { kind: 'input' }
  /** Cannot be targeted by farming a mechanic (idols…): excluded. */
  | { kind: 'ignored' };

interface MechanicMap {
  categories: Partial<Record<ExchangeType, FarmRole>>;
  /** Checked first, in order: items of `type` whose name matches `name`. */
  overrides: readonly { type: ExchangeType; name: RegExp; role: FarmRole }[];
}

const mechanic = (name: string): FarmRole => ({ kind: 'mechanic', mechanic: name });
const ANY: FarmRole = { kind: 'any' };

export const MECHANIC_MAPS: Record<Game, MechanicMap> = {
  // Checked against the Forbidden Rites overviews (2026-10-24).
  poe2: {
    categories: {
      Breach: mechanic('Breach'),
      Delirium: mechanic('Delirium'),
      Ritual: mechanic('Ritual'),
      Expedition: mechanic('Expedition'),
      Verisium: mechanic('Expedition'),
      Abyss: mechanic('Abyss'),
      Essences: mechanic('Essences'),
      Fragments: mechanic('Bosses'),
      Idols: { kind: 'ignored' },
      Currency: ANY,
      UncutGems: ANY,
      LineageSupportGems: ANY,
      Runes: ANY,
      SoulCores: ANY,
    },
    overrides: [
      { type: 'Fragments', name: /^Simulacrum/, role: mechanic('Delirium') },
      { type: 'Fragments', name: /^Breachlord Sac$/, role: mechanic('Breach') },
      { type: 'Fragments', name: / Fate$/, role: mechanic('Ultimatum') },
    ],
  },
  // 3.29 Allflame categories; redo for 3.30 at launch (spec 09 §7).
  poe1: {
    categories: {
      Essence: mechanic('Essences'),
      DeliriumOrb: mechanic('Delirium'),
      Fossil: mechanic('Delve'),
      Resonator: mechanic('Delve'),
      Oil: mechanic('Blight'),
      Artifact: mechanic('Expedition'),
      Tattoo: mechanic('Expedition'),
      Omen: mechanic('Ritual'),
      Runegraft: mechanic('Kingsmarch'),
      EnshroudingCrystal: mechanic('Legion'),
      Fragment: mechanic('Bosses'),
      Currency: ANY,
      DivinationCard: ANY,
      Scarab: { kind: 'input' },
      Astrolabe: { kind: 'input' },
    },
    overrides: [
      { type: 'Fragment', name: /^Simulacrum/, role: mechanic('Delirium') },
      { type: 'Fragment', name: /^Timeless /, role: mechanic('Legion') },
    ],
  },
};

/** The role of an item in `game` (unmapped categories: their own mechanic row). */
export function farmRole(game: Game, item: Pick<CurrentItem, 'type' | 'name'>): FarmRole {
  const map = MECHANIC_MAPS[game];
  const override = map.overrides.find((o) => o.type === item.type && o.name.test(item.name));
  return override?.role ?? map.categories[item.type] ?? mechanic(EXCHANGE_TYPE_LABELS[item.type]);
}
