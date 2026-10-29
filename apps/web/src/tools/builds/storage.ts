import { buildSchema, type Build, type Game } from '@poe-tools/shared';

/*
 * Builds live in the browser (spec 10), one list per game, and travel with the app-wide
 * backup. Invalid stored entries are dropped on load rather than breaking the page.
 */

const storageKey = (game: Game) => `poe-tools:builds:${game}`;

export function loadBuilds(game: Game): Build[] {
  try {
    const raw = localStorage.getItem(storageKey(game));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((entry) => {
      const parsed = buildSchema.safeParse(entry);
      return parsed.success && parsed.data.game === game ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function storeBuilds(game: Game, builds: readonly Build[]): void {
  try {
    localStorage.setItem(storageKey(game), JSON.stringify(builds));
  } catch {
    // Storage full or unavailable: the change lives until the page reloads.
  }
}

export function newBuild(game: Game, now = new Date()): Build {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    game,
    ascendancy: '',
    links: [],
    updatedAt: now.toISOString(),
  };
}
