import { ENABLED_GAMES, getDefaultLeague, type Game } from '@poe-tools/shared';

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
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaults;
  }
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
