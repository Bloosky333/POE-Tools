export const GAMES = ['poe2', 'poe1'] as const;

export type Game = (typeof GAMES)[number];

export const GAME_LABELS: Record<Game, string> = {
  poe2: 'Path of Exile 2',
  poe1: 'Path of Exile 1',
};

/** Games whose tools are usable today; others are shown as "coming soon". */
export const ENABLED_GAMES: readonly Game[] = ['poe2'];
