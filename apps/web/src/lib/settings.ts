import { ENABLED_GAMES, getDefaultLeague, getLeague, type Game } from '@poe-tools/shared';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  game: Game;
  leagueId: string;
  theme: Theme;
}

const STORAGE_KEY = 'poe-tools:settings';

export function defaultSettings(): Settings {
  const game = ENABLED_GAMES[0] ?? 'poe2';
  return { game, leagueId: getDefaultLeague(game)?.id ?? '', theme: 'dark' };
}

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return withValidLeague({ ...defaults, ...(JSON.parse(raw) as Partial<Settings>) });
  } catch {
    return defaults;
  }
}

/**
 * Applies a settings change; switching game selects that game's default league. A stored
 * league that no longer exists or belongs to another game is replaced the same way.
 */
export function applySettings(prev: Settings, patch: Partial<Settings>): Settings {
  const next = { ...prev, ...patch };
  if (patch.game && patch.game !== prev.game && !patch.leagueId) next.leagueId = '';
  return withValidLeague(next);
}

function withValidLeague(settings: Settings): Settings {
  const game = ENABLED_GAMES.includes(settings.game) ? settings.game : defaultSettings().game;
  const league = getLeague(settings.leagueId);
  const valid = league?.game === game && league.selectable;
  return {
    ...settings,
    game,
    leagueId: valid ? settings.leagueId : (getDefaultLeague(game)?.id ?? ''),
  };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, blocked): settings just won't persist.
  }
}

export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
